# NPMplus Multi-Language Support

## Overview
NPMplus now supports multiple languages including Turkish (Türkçe). The language system automatically detects the user's browser language and provides a dropdown selector for manual language switching.

## Supported Languages
- 🇺🇸 English (en)
- 🇩🇪 Deutsch (de) 
- 🇮🇹 Italiano (it)
- 🇨🇳 中文 (zh)
- 🇹🇷 Türkçe (tr) - **Newly Added**

## Implementation Details

### Language Files
Language translations are stored in JSON format in `/frontend/js/i18n/`:
- `en-lang.json` - English (base language)
- `de-lang.json` - German
- `it-lang.json` - Italian  
- `zh-lang.json` - Chinese
- `tr-lang.json` - Turkish (**New**)

### Key Features Added

#### 1. Turkish Language File (`tr-lang.json`)
Complete translation of all UI elements including:
- Main navigation and menus
- Form labels and buttons
- Error messages and notifications
- Help text and descriptions
- Status indicators

#### 2. Language Detection
- Automatic detection from browser language settings
- Fallback to localStorage preference
- Default to English if no match found

#### 3. Language Selector UI
- Added dropdown in footer with flag icons
- Real-time language switching
- Persistent language preference storage

#### 4. Dynamic Language Loading
Updated `i18n.js` to support Turkish:
```javascript
if (locale.includes('tr')) {
    messages = { ...messages, ...require('../i18n/tr-lang.json') };
}
```

#### 5. Enhanced Cache System
Added language management functions to `cache.js`:
```javascript
setLanguage: function(lang) {
    this.locale = lang;
    localStorage.setItem('language', lang);
    window.location.reload();
},

getAvailableLanguages: function() {
    return {
        'en': '🇺🇸 English',
        'de': '🇩🇪 Deutsch', 
        'it': '🇮🇹 Italiano',
        'zh': '🇨🇳 中文',
        'tr': '🇹🇷 Türkçe'
    };
}
```

## How to Use

### For Users
1. Language is automatically detected from browser settings
2. Use the language dropdown in the footer to manually switch languages
3. Language preference is saved and remembered across sessions

### For Developers
1. All translatable strings use the `i18n()` function
2. Add new translations to the appropriate language files
3. Use proper namespace and key structure:
```javascript
i18n('namespace', 'key', {data})
```

## Translation Guidelines

### Best Practices
1. **Context Awareness**: Translate based on context, not literal word-for-word
2. **Consistency**: Use the same translation for repeated terms
3. **Technical Terms**: Keep technical terms in English when appropriate
4. **UI Conventions**: Follow Turkish UI/UX conventions
5. **Proper Encoding**: Use UTF-8 encoding for Turkish characters (ç, ğ, ı, ö, ş, ü)

### Turkish-Specific Guidelines
- Use formal language for professional context
- Technical terms like "proxy", "SSL", "DNS" kept in English
- Button actions use imperative form (e.g., "Kaydet", "Sil", "Ekle")
- Error messages are user-friendly and informative

## File Structure
```
frontend/
├── js/
│   ├── app/
│   │   ├── i18n.js              # Language loading logic
│   │   ├── cache.js             # Language preference storage
│   │   └── ui/
│   │       └── footer/
│   │           ├── main.js      # Footer with language selector
│   │           └── main.ejs     # Footer template
│   └── i18n/
│       ├── en-lang.json         # English (base)
│       ├── de-lang.json         # German
│       ├── it-lang.json         # Italian
│       ├── zh-lang.json         # Chinese
│       └── tr-lang.json         # Turkish (NEW)
└── html/
    └── partials/
        └── header.ejs           # Language meta tags
```

## Future Enhancements
1. Add more languages based on user requests
2. Implement plural forms for better grammar
3. Add date/time localization
4. Consider RTL language support
5. Add language-specific number formatting

## Testing
To test the Turkish language implementation:
1. Build the frontend: `npm run build`
2. Start the application
3. Use the language dropdown in the footer
4. Verify all UI elements display in Turkish
5. Check that language preference persists across page reloads

## Contributing
To add support for a new language:
1. Create a new language file in `/frontend/js/i18n/`
2. Update the `i18n.js` file to include the new language
3. Add the language to the dropdown in `footer/main.ejs`
4. Update the `getAvailableLanguages()` function in `cache.js`
5. Test thoroughly and ensure all strings are translated
