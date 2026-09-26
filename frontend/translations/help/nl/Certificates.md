## Certificaten - Hulp

### HTTP-certificaat

Een HTTP-gevalideerd certificaat betekent dat Certbot-servers zullen proberen uw domeinen te bereiken via HTTP (niet HTTPS!) en als dit lukt, geven ze uw certificaat af.

Voor deze methode moet u een _Proxy Host_ laten maken voor uw domein(en) die toegankelijk is met HTTP en die naar deze Nginx-installatie verwijst. Nadat een certificaat is gegeven, kunt u de _Proxy Host_ wijzigen om dit certificaat ook voor HTTPS-verbindingen te gebruiken. De _Proxy Host_ moet echter nog steeds worden geconfigureerd voor HTTP-toegang voordat het certificaat kan worden verlengd.

Dit proces ondersteunt _niet_ jokertekendomeinen.

### DNS-certificaat

Een DNS gevalideerd certificaat vereist dat u een DNS-provider plugin gebruikt. Deze DNS-provider wordt gebruikt om tijdelijke records op uw domein aan te maken en vervolgens zal Certbot die records opvragen om er zeker van te zijn dat u de eigenaar bent en als dit lukt, zullen zij uw certificaat afgeven.

U heeft geen _Proxy Host_ nodig voordat u dit type certificaat aanvraagt. U hoeft uw _Proxy Host_ ook niet te laten configureren voor HTTP-toegang.

Dit proces ondersteunt _wel_ wildcard-domeinen.

### Aangepast certificaat

Gebruik deze optie om uw eigen TLS-certificaat te uploaden, zoals verstrekt door uw eigen Certificaatautoriteit.
