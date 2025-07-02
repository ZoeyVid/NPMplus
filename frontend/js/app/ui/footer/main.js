const Mn       = require('backbone.marionette');
const template = require('./main.ejs');
const Cache    = require('../../cache');

module.exports = Mn.View.extend({
    className: 'container',
    template:  template,
    
    templateContext: function() {
        return {
            availableLanguages: Cache.getAvailableLanguages(),
            currentLanguage: Cache.locale
        };
    },
    
    onRender: function() {
        // Update language display after rendering
        this.updateLanguageDisplay();
    },
    
    updateLanguageDisplay: function() {
        const languages = Cache.getAvailableLanguages();
        const currentLang = Cache.locale;
        const langKey = Object.keys(languages).find(key => currentLang.includes(key)) || 'en';
        const langElement = this.$el.find('#current-language');
        if (langElement.length) {
            langElement.text(languages[langKey]);
        }
    }
});
