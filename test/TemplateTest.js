/* eslint no-undef: "off" */

const SRC = '../src';
const template = require(`${SRC}/Template`);

describe("Template test suite: ", function() {

    it("ejs", function() {
        const f = template('ejs', 'hi <%=you%>');
        expect(f instanceof Function).toBeTruthy();
        expect(f({ you: 'Qiang Yiting' })).toBe('hi Qiang Yiting');
    });

    it("mustache", function() {
        const f = template('mustache', 'hi {{you}}');
        expect(f instanceof Function).toBeTruthy();
        expect(f({ you: 'Qiang Yiting' })).toBe('hi Qiang Yiting');
    });

    it("lodash", function() {
        const f = template('lodash', 'hi <%=you%>');
        expect(f instanceof Function).toBeTruthy();
        expect(f({ you: 'Qiang Yiting' })).toBe('hi Qiang Yiting');
    });

    it("underscore", function() {
        const f = template('underscore', 'hi <%=you%>');
        expect(f instanceof Function).toBeTruthy();
        expect(f({ you: 'Qiang Yiting' })).toBe('hi Qiang Yiting');
    });

    it("handlebars", function() {
        const f = template('handlebars', 'hi {{you}}');
        expect(f instanceof Function).toBeTruthy();
        expect(f({ you: 'Qiang Yiting' })).toBe('hi Qiang Yiting');
    });

    it("jade", function() {
        const f = template('jade', 'div #{you}');
        expect(f instanceof Function).toBeTruthy();
        expect(f({ you: 'Qiang Yiting' })).toBe('<div>Qiang Yiting</div>');
    });

    it("pug", function() {
        const f = template('pug', 'div #{you}');
        expect(f instanceof Function).toBeTruthy();
        expect(f({ you: 'Qiang Yiting' })).toBe('<div>Qiang Yiting</div>');
    });

    it("unknown template type", function() {
        try {
            template('xxx', 'hi {{you}}');
            failhere();
        } catch (e) {
            expect(e.type.key).toBe('UNSUPPORTED_TEMPLATE_TYPE');
        }
    });


});