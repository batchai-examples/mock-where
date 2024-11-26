const RequestError = require('qnode-error').RequestError;
const RuleTree = require('./RuleTree');
const Template = require('./Template');
const TemplateContext = require('./TemplateContext');

module.exports = class RuleEngine {

    constructor(name, config) {
        this._name = name;
        this._config = config;
    }

    normalizeConfig(config) {
        config.record = (config.record === null || config.record === undefined) ? true : config.record;
    }

    init() {
        this.normalizeConfig(this._config);

        this._ruleTree = new RuleTree(this._name + 'RuleTree');

        if (this._config.record) {
            this._RnRDao = this._beans.load('RnRDao');
        }

        this._initRules();
    }

    _initRules() {
        const rules = this._config.rules;
        for (const ruleName in rules) {
            const rule = rules[ruleName];
            this.put(rule);
        }
    }

    put(rule) {
        this.prepareRule(rule);
        this._ruleTree.put(rule);
    }

    _buildRequestData(req) {
        return {
            charset: req.charset,
            ip: req.ip,
            method: req.method,
            path: req.path,
            protocol: req.protocol,
            q: req.query,
            url: req.url
        };
    }

    static renderMockResponse(request, ruleResponse, responseToMock) {
        if (ruleResponse.header) Object.assign(responseToMock.header, ruleResponse.header);

        responseToMock.type = ruleResponse.type;
        responseToMock.status = ruleResponse.status;

        const context = TemplateContext.normalize({ request });
        responseToMock.body = Template.render(ruleResponse.body, context);

        //if (ruleResponse.redirect) responseToMock.redirect(ruleResponse.redirect);
    }

    static determineTimeToLatency(ruleResponse) {
        if (!ruleResponse) {
            return 0; // Return 0 if ruleResponse is not defined
        }
        let latency = ruleResponse.latency + ruleResponse.latencyFix;
        if (latency && latency > 0) {
            return latency;
        }
        return 0;
    }

    /**
     * looks for matched rule, raise error if matches nothing
     * @param {object} request 
     */
    loadMatchedRule(request) {
        this._logger.debug('request: %s', request);
        const r = this._findMatchedRule(request);
        if (!r) {
            throw new RequestError('NO_RULE_MATCHES');
        }
        return r;
    }

    _findMatchedRule(request) {
        const candidateRules = this._ruleTree.match(request.method, request.path);

        if (this._logger.isDebugEnabled()) {
            this._logger.debug('candidate rules: %s', candidateRules);
        }

        return this._filterRule(request, candidateRules);
    }

    _filterRule(req, candidateRules) {
        return (candidateRules.length > 0) ? candidateRules[0] : null;
    }

    prepareRule() {
        // dummy
    }

    /**
     * return mocked response for incoming request.
     * 
     * it looks for matched rule, rendering mock response using the rule, and
     * executes hooks around the response.
     * 
     * @param {object} rnr request and response
     */
    async mock(ctx, rnr, port) {
        const rule = this.loadMatchedRule(rnr.request);

        try {
            if (rule.proxy && rule.proxy.isEnabled()) {
                await rule.proxy.doProxy(ctx);
                //TODO: record
                return;
            }

            const hook = rule.hook;

            if (hook && hook.needCallBefore()) {
                try {
                    await hook.callBefore(rnr);
                } catch (e) {
                    this._logger.error(e);
                }
            }

            await this._mockResponse(rnr, rule);

            if (hook && hook.needCallAfter()) {
                try {
                    await hook.callAfter(rnr);
                } catch (e) {
                    this._logger.error(e);
                }
            }
        } finally {
            if (this._config.record) {
                this._RnRDao.insert(rnr.request, rnr.response, port);
            }
        }
    }

    /**
     * return mocked response, and, latency somewhile if configured
     * 
     * @param {object} rnr request and response
     * @param {object} rule 
     */
    async _mockResponse(rnr, rule) {
        const ruleResponse = rule.response;
        RuleEngine.renderMockResponse(rnr.request, ruleResponse, rnr.response);

        //TODO: be aware of how the hook latency interferes the response latency
        let latency = RuleEngine.determineTimeToLatency(ruleResponse);
        if (latency) {
            return new Promise(resolve => setTimeout(resolve, latency));
        }

        return Promise.resolve();
    }


}
