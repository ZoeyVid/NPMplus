const Backbone = require('backbone');

const model = Backbone.Model.extend({
    idAttribute: 'line_number',

    defaults: function () {
        return {
            line_number: undefined,
            timestamp:   null,
            ip:          null,
            method:      null,
            url:         null,
            status:      null,
            size:        null,
            user_agent:  null,
            raw_line:    ''
        };
    }
});

module.exports = {
    Model:      model,
    Collection: Backbone.Collection.extend({
        model: model
    })
};
