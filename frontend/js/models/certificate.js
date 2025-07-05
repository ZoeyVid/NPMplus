const Backbone = require('backbone');

const model = Backbone.Model.extend({
    idAttribute: 'id',

    defaults: function () {
        return {
            id:                undefined,
            created_on:        null,
            modified_on:       null,
            certificate_type:  'acme',
            nice_name:         '',
            domain_names:      [],
            acme_server_id:    null,
            expires_on:        null,
            meta:              {},
            // The following are expansions:
            owner:             null,
            acme_server:       null,
            proxy_hosts:       [],
            redirection_hosts: [],
            dead_hosts:        []
        };
    },

    /**
     * @returns {Boolean}
     */
    isNew: function () {
        return this.get('id') == null;
    },

    /**
     * @returns {Boolean}
     */
    hasSslFiles: function () {
        let meta = this.get('meta');
        return typeof meta['certificate'] !== 'undefined' && meta['certificate'] && typeof meta['certificate_key'] !== 'undefined' && meta['certificate_key'];
    }
});

module.exports = {
    Model:      model,
    Collection: Backbone.Collection.extend({
        model: model
    })
};
