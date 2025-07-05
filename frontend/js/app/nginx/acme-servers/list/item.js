const Mn       = require('backbone.marionette');
const App      = require('../../../main');
const template = require('./item.ejs');

module.exports = Mn.View.extend({
    template: template,
    tagName:  'tr',

    ui: {
        name:        'a.name',
        edit:        'a.edit',
        delete:      'a.delete'
    },

    events: {
        'click @ui.name': function (e) {
            e.preventDefault();
            App.Controller.showNginxAcmeServerForm(this.model);
        },

        'click @ui.edit': function (e) {
            e.preventDefault();
            App.Controller.showNginxAcmeServerForm(this.model);
        },

        'click @ui.delete': function (e) {
            e.preventDefault();
            App.Controller.showNginxAcmeServerDeleteConfirm(this.model);
        }
    },

    templateContext: {
        canManage: App.Cache.User.canManage('acme_servers'),

        getStatusColor: function () {
            if (this.is_default) {
                return 'success';
            }
            return 'secondary';
        },

        getStatusText: function () {
            if (this.is_default) {
                return App.i18n('acme-servers', 'default');
            }
            return App.i18n('acme-servers', 'available');
        },

        getProfileText: function () {
            if (this.profile === 'none') {
                return App.i18n('acme-servers', 'profile-none');
            }
            return this.profile;
        },

        hasEAB: function () {
            return this.eab_kid && this.eab_hmac_key;
        }
    }
});
