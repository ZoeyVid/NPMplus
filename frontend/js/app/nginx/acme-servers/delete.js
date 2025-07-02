const Mn               = require('backbone.marionette');
const App              = require('../../main');
const template         = require('./delete.ejs');

module.exports = Mn.View.extend({
    template:  template,
    className: 'modal-dialog',

    ui: {
        form:   'form',
        error:  '.secret-error',
        buttons: '.modal-footer button',
        cancel: 'button.cancel',
        save:   'button.save'
    },

    events: {
        'click @ui.save': function (e) {
            e.preventDefault();

            this.ui.buttons.prop('disabled', true).addClass('btn-loading');
            App.Api.Nginx.AcmeServers.delete(this.model.get('id'))
                .then(() => {
                    App.UI.closeModal(function () {
                        App.Controller.showNginxAcmeServers();
                    });
                })
                .catch(err => {
                    this.ui.error.text(err.message).show();
                    this.ui.buttons.prop('disabled', false).removeClass('btn-loading');
                });
        }
    },

    templateContext: function () {
        let view = this;

        return {
            model: view.model.toJSON()
        };
    }
});
