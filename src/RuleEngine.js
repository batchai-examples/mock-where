const RequestError = require('./error/RequestError');
const alasql = require('alasql');
const getLogger = require('./Logger');
const resolveTemplateFunc = require('./Template');
const RuleTree = require('./RuleTree');


class RuleEngine {

    constructor(name, definition) {
        this.name = name;
        this._definition = definition;
        this._logger = getLogger(name);
        this._ruleTree = new RuleTree();
        this._ruleDb = this._initRuleDatabase();
        this._nameIndex = 0;

        for (let ruleName in definition.rules) {
            this.put(definition.rules[ruleName]);
        }
    }

    _initRuleDatabase() {
        const r = new alasql.Database('rule');
        this._logger.debug('rule database is created');

        r.exec('create table request');
        this._logger.debug('request table is is created');

        return r;
    }

    put(rule) {
        const dft = this._definition.default || {};

        rule.name = rule.name || (this.name + this._nameIndex++);
        rule.path = rule.path || (dft.path || '/');
        rule.method = (rule.method || (dft.method || 'get')).toLowerCase();

        const q = rule.q = rule.q || dft.q;
        rule.statement = 'select * from request' + (q ? ` where ${q}` : '');

        rule.response = rule.response || (dft.response || {});
        this._normalizeResponse(rule.response);

        this._ruleTree.put(rule);
    }


    _normalizeResponse(response) {
        response.status = response.status || 200;
        response.type = response.type || 'application/json';

        if (response.template && response.body) throw new RequestError('MULTIPLE_RESPONSE_CONTENTS_NOT_ALLOWED');
        if (!response.template) {
            response.body = response.body || 'no response body specified';
        } else {
            response.template = this._normalizeTemplate(response.template);
        }

        response.sleep = response.sleep || 0;
        response.sleepFix = response.sleepFix || -10;
    }

    _normalizeTemplate(template) {
        let type;
        let text;
        if (typeof template === 'string') {
            type = 'ejs';
            text = template;
        } else {
            type = template.type || 'ejs';
            text = template.text || 'template not specified';
        }

        return {
            type,
            text,
            func: resolveTemplateFunc(type, text)
        };
    }


    _normalizeRequest(req) {
        return {
            header: req.header,
            method: req.method.toLowerCase(),
            //length: req.length,
            url: req.url,
            path: req.path,
            //type: req.type,
            charset: req.charset,
            query: req.query,
            protocol: req.protocol,
            ip: req.ip,
            body: req.body
        };
    }

    _findMatchedRule(req) {
        this._logger.debug('request: %s', req);

        this._ruleDb.exec('begin transaction');

        try {
            const insertSql = `INSERT INTO request (url,charset,protocol,ip) VALUES ("${req.url}","${req.charset}","${req.protocol}","${req.ip}")`;
            this._ruleDb.exec(insertSql);

            const rules = this._ruleTree.match(req.method, req.path);
            this._logger.debug('candidate rules: %s', rules);

            for (const rule of rules) {
                const statement = rule.statement;
                this._logger.debug(`executing: ${statement}`);

                const matched = this._ruleDb.exec(statement);
                if (matched.length > 0) {
                    this._logger.info('found matched rule: %s', rule);
                    return rule;
                }
            }

            return null;
        } finally {
            this._ruleDb.exec('rollback transaction');
        }
    }


    async mock(ctx, next) {
        const request = this._normalizeRequest(ctx.request);
        const rule = this._findMatchedRule(request);
        if (!rule) throw new RequestError('NO_RULE_MATCHES');

        const ruleResponse = rule.response;
        const responseToMock = ctx.response;

        if (ruleResponse.header) Object.assign(responseToMock.header, ruleResponse.header);

        responseToMock.status = ruleResponse.status;

        if (ruleResponse.template) {
            try {
                responseToMock.message = ruleResponse.template.func(request);
            } catch (e) {
                throw new RequestError('FAILED_TO_GENERATE_RESPONSE_WITH_TEMPLATE', e.message);
            }
        } else {
            responseToMock.body = ruleResponse.body;
        }

        responseToMock.type = ruleResponse.type;

        //if (ruleResponse.redirect) responseToMock.redirect(ruleResponse.redirect);

        let sleep = ruleResponse.sleep + ruleResponse.sleepFix;
        if (sleep || sleep > 0) {
            await new Promise(resolve => setTimeout(resolve, sleep));
        }

        await next();
    }


}

module.exports = RuleEngine;