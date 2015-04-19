import Immutable from 'immutable';
import { Suite, Action, go } from '../src/integrator';
import utils from '../src/utils';
import assert from './example-assert';
import ElementMatcher from 'integrator-match';

// ACTIONS

let session; // YUK YUK YUK
let config; // YUK YUK YUK
let matcher = new ElementMatcher({ path: 'matcher-specs' });

const testUtils = {
    compareList: utils.effect(model => {
        return session
            .findByCssSelector('.List-list')
            .then(elem => elem.findAllByCssSelector('li span'))
            .then(elems => Promise.all(elems.map(elem => elem.getVisibleText())))
            .then(items => {
                assert.ok(
                    items.length === model.get('list').count(),
                    'Rendered list items does not match model'
                );
            });
    }),

    compareCreateText: utils.effect(model => {
        return matcher.get(session, 'Create-text')
            .then(elem => elem.getProperty('value'))
            .then(value => {
                assert.ok(
                    value === model.get('createText'),
                    'Create text is wrong'
                );
            });
    })
};

const model = Immutable.fromJS({
    createText: '',
    list: Immutable.List()
});

let actions = Immutable.List([
    Action('open app', [], {
        setup: utils.effect(() => session.get(config.base + '/examples/pages/list-app.html')),

        assert: utils.effect(() => {
            return session
                .getPageTitle()
                .then(title => {
                    assert.ok(
                        title.trim() === 'List App',
                        'Title is wrong'
                    );
                });
        })
    }),

    Action('write a new list item', ['open app'], {
        fixtures: {
            text: utils.defaultTo('Hello, world!')
        },

        setup: (model, fixtures) => {
            return matcher.get(session, 'Create-text')
                .then(elem => elem.type(fixtures.get('text')))
                .then(() => model.set('createText', fixtures.get('text')));
        },

        assert: testUtils.compareCreateText,

        teardown: model => {
            return matcher.get(session, 'Create-text')
                .then(elem => elem.clearValue())
                .then(() => model.set('createText', ''));
        },

        done: testUtils.compareCreateText
    }),

    Action('add new list item', ['write a new list item'], {
        setup: model => {
            return matcher.get(session, 'Create-submit')
                .then(elem => elem.click())
                .then(() =>
                    model
                        .update('list', list => {
                            if (!model.get('createText') || model.get('createText').length > 40) {
                                return list;
                            }
                            return list.concat(model.get('createText'));
                        })
                        .update('createText', createText => {
                            return (createText.length > 40 ? createText : '');
                        })
                );
        },

        assert: testUtils.compareCreateText
    }),

    Action('try adding empty item', ['add new list item'], {
        fixtures: {
            text: ''
        },

        assert: testUtils.compareList
    }),

    Action('try adding too-long item', ['add new list item'], {
        fixtures: {
            text: 'This item is too long and will not be accepted'
        },

        assert: testUtils.compareList
    }),

    Action('remove the last list item', ['add new list item'], {
        fixtures: {
            text: 'Will be removed!'
        },

        setup: model => {
            return session
                .findAllByCssSelector('.List-list .List-item-remove')
                .then(elems => Immutable.List(elems).last())
                .then(elem => elem.click())
                .then(() => model.update('list', list => list.pop()));
        },

        assert: testUtils.compareList
    })
]);

// RUN

const initSuite = (_session, _config) => {
    session = _session;
    config = _config;
    return Suite(actions, model);
};

export default initSuite;
