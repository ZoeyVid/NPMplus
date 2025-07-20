const _                = require('underscore');
const Mn               = require('backbone.marionette');
const App              = require('../../main');
const AcmeServerModel  = require('../../../models/acme-server');
const template         = require('./form.ejs');

require('jquery-serializejson');

module.exports = Mn.View.extend({
    template:  template,
    className: 'modal-dialog',

    ui: {
        form:               'form',
        buttons:            '.modal-footer button',
        cancel:             'button.cancel',
        save:               'button.save',
        name:               'input[name="name"]',
        description:        'input[name="description"]',
        server_url:         'input[name="server_url"]',
        email:              'input[name="email"]',
        eab_kid:            'input[name="eab_kid"]',
        eab_hmac_key:       'input[name="eab_hmac_key"]',
        profile:            'select[name="profile"]',
        key_type:           'select[name="key_type"]',
        must_staple:        'input[name="must_staple"]',
        ocsp_stapling:      'input[name="ocsp_stapling"]',
        tls_verify:         'input[name="tls_verify"]',
        eab_section:        '.eab-section',
        show_eab:           'input[name="show_eab"]'
    },

    events: {
        'change @ui.show_eab': function () {
            const checked = this.ui.show_eab.prop('checked');
            if (checked) {
                this.ui.eab_section.show();
            } else {
                this.ui.eab_section.hide();
                this.ui.eab_kid.val('');
                this.ui.eab_hmac_key.val('');
            }
        },

        'click @ui.save': function (e) {
            e.preventDefault();

            if (!this.ui.form[0].checkValidity()) {
                $('<input type="submit">').hide().appendTo(this.ui.form).click().remove();
                return;
            }

            let data = this.ui.form.serializeJSON();
            
            // Remove UI-only fields that shouldn't be sent to server
            if (data.show_eab !== undefined) {
                delete data.show_eab;
            }
            
            // Convert string values to proper types
            data.must_staple = !!data.must_staple;
            data.ocsp_stapling = !!data.ocsp_stapling;
            data.tls_verify = !!data.tls_verify;

            // Set default values
            if (!data.description) data.description = '';
            if (!data.email) data.email = '';
            if (!data.eab_kid) data.eab_kid = '';
            if (!data.eab_hmac_key) data.eab_hmac_key = '';
            if (!data.profile) data.profile = 'none';
            if (!data.key_type) data.key_type = 'ecdsa';

            this.ui.buttons.prop('disabled', true).addClass('btn-loading');
            let method = App.Api.Nginx.AcmeServers.create;

            if (this.model.get('id')) {
                // edit
                method = App.Api.Nginx.AcmeServers.update;
                data.id = this.model.get('id');
            }

            method(data)
                .then(result => {
                    App.UI.closeModal(function () {
                        App.Controller.showNginxAcmeServers();
                    });
                })
                .catch(err => {
                    let more_info = '';
                    if (err.code === 500 && err.debug) {
                        try {
                            more_info = JSON.parse(err.debug).debug.stack.join("\n");
                        } catch(e) {}
                    }
                    
                    // Show error message in modal
                    let errorMsg = `${err.message || 'An error occurred'}${more_info !== '' ? `<pre class="mt-3">${more_info}</pre>` : ''}`;
                    
                    // Create or update error alert
                    let errorAlert = this.$('.alert-danger');
                    if (errorAlert.length === 0) {
                        errorAlert = $('<div class="alert alert-danger"></div>').prependTo(this.$('.modal-body'));
                    }
                    errorAlert.html(errorMsg).show();
                    errorAlert[0].scrollIntoView();
                    
                    this.ui.buttons.prop('disabled', false).removeClass('btn-loading');
                });
        }
    },

    onRender: function () {
        let view = this;

        // Set form values if editing
        if (!this.model.isNew()) {
            this.ui.name.val(this.model.get('name'));
            this.ui.description.val(this.model.get('description'));
            this.ui.server_url.val(this.model.get('server_url'));
            this.ui.email.val(this.model.get('email'));
            this.ui.profile.val(this.model.get('profile'));
            this.ui.key_type.val(this.model.get('key_type'));
            this.ui.must_staple.prop('checked', this.model.get('must_staple'));
            this.ui.ocsp_stapling.prop('checked', this.model.get('ocsp_stapling'));
            this.ui.tls_verify.prop('checked', this.model.get('tls_verify'));
            this.ui.is_default.prop('checked', this.model.get('is_default'));

            // Show EAB section if data exists
            if (this.model.get('eab_kid') || this.model.get('eab_hmac_key')) {
                this.ui.show_eab.prop('checked', true);
                this.ui.eab_section.show();
                this.ui.eab_kid.val(this.model.get('eab_kid'));
                this.ui.eab_hmac_key.val(this.model.get('eab_hmac_key'));
            }
        } else {
            // Default values for new server
            this.ui.key_type.val('ecdsa');
            this.ui.profile.val('none');
            this.ui.tls_verify.prop('checked', true);
        }
    },

    templateContext: function () {
        let view = this;

        return {
            isNew: view.model.isNew()
        };
    }
});
