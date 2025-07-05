const Backbone = require('backbone');

const model = Backbone.Model.extend({
    idAttribute: 'id',

    defaults: function () {
        return {
            id:              undefined,
            created_on:      null,
            modified_on:     null,
            owner_user_id:   1,
            name:            '',
            description:     '',
            server_url:      '',
            email:           '',
            eab_kid:         '',
            eab_hmac_key:    '',
            profile:         'none',
            key_type:        'ecdsa',
            must_staple:     false,
            ocsp_stapling:   false,
            tls_verify:      true,
            meta:            {},
            // The following are expansions:
            owner:           null
        };
    },

    /**
     * @returns {Boolean}
     */
    isNew: function () {
        return this.get('id') == null;
    },

    /**
     * @returns {String}
     */
    getName: function () {
        return this.get('name');
    }
});

module.exports = {
    Model:      model,
    Collection: Backbone.Collection.extend({
        model: model
    })
};
