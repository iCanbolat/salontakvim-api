# Widget Güvenlik Özeti

## Mevcut Güvenlik Önlemleri

- **İmzalı Embed Token (HMAC-SHA256):** `storeId/slug` [+ opsiyonel domain] bilgilerini içeren, varsayılan olarak **900 saniye (15 dakika)** ömrü olan kısa vadeli tokenlar kullanılır. Bu tokenlar embed yanıtlarında verilir ve her public widget çağrısında `validatePublicAccess` metodunda doğrulanır.
- **Domain İzin Listesi (Allowlist):** Widget ayarlarında tanımlı domainler, `validateDomainAccess` ile Origin/Referer başlıkları üzerinden kontrol edilir. `ENABLE_EMBED_DOMAIN_CHECK` ile embed script uç noktalarında ve `ENABLE_TOKEN_DOMAIN_BINDING` ile token bazında domain zorunluluğu sağlanabilir.
- **Widget Key:** 32-byte rastgele hex (`generateWidgetKey`) formatındadır ve her zaman imzalı bir token ile birlikte kullanılır. Token ve domain kontrolü olmadan tek başına widget key kullanımı erişimi bypass etmek için yeterli değildir.
- **Hız Sınırlama (Rate Limiting):** Public uç noktalar `PublicRateLimitGuard` ile korunur (IP ve Route bazlı hafıza içi pencere: 120 istek/dakika). Slug ve widgetKey çözücüleri mağazalar arası veri sızıntısını önler.
- **Embed Yükleyici Script:** Kısa ömürlü token ve API base URL'ini ancak bağlam çözüldükten sonra sunar. Tokenlar süresi dolduğunda veya key rotasyonu yapıldığında geçersiz kalır.

## Token Ömrü Analizi (15 Dakika)

Mevcut durumda tokenlar **15 dakika** yaşar.

- **Yeterli mi?** Bir randevu alma süreci için (hizmet seçimi, personel seçimi, tarih belirleme ve iletişim bilgileri) 15 dakika genellikle makul ve yeterli bir süredir. Kullanıcının formu doldururken takılsa bile işlemi tamamlamasına imkan tanır.
- **Güvenlik Riski:** 15 dakika, "kısa ömürlü" olarak kabul edilse de; bir token çalındığında veya sızdırıldığında bu süre boyunca istismara açıktır. Domain binding (Seviye 2) kapalıysa risk artar.
- **Öneri:** Çok yoğun trafikli veya yüksek güvenlik gerektiren işletmeler için bu süre 5 dakikaya çekilebilir veya "yenileme" (refresh) mekanizması eklenebilir. Ancak mevcut "statik embed" yapısında 15 dakika kullanıcı deneyimi ve güvenlik dengesi açısından idealdir.

## İstismar Yüzeyi Analizi (Widget Key/Token)

- **Token Sızıntısı:** Token sızdırıldığında süresi dolana kadar kullanılabilir. Eğer domain binding kapalıysa veya izin listesi boşsa, çalınan bir token başka bir kaynaktan süresi bitene kadar tekrar oynatılabilir.
- **Varsayılan Secret Riski:** `EMBED_TOKEN_SECRET` yapılandırılmazsa kullanılan varsayılan veya zayıf anahtarlar token forgery (sahte token üretimi) riskine yol açar. Prod ortamında mutlaka güçlü bir secret kullanılmalıdır.
- **Bellek İçi Rate Limit:** Çoklu sunucu (multi-instance) yapılarında her sunucunun kendi belleği olduğu için limitler aşılabilir. Ayrıca proxy arkasındaki IP adresleri manipüle edilebilir.
- **Boş Domain İzin Listesi:** Herhangi bir domain kısıtlaması olmaması, token olsa bile istenilen sitede widget'ın çalıştırılmasına izin verir.
- **XSS Riski:** Tokenlar DOM dataset üzerinde (loader script) açıkça göründüğü için, host sayfasındaki bir XSS açığı tokenların süresi dolana kadar çalınmasına neden olabilir.

## Güvenlik Sıkılaştırma Önerileri

1. **Gelişmiş Rate Limiting:** `PublicRateLimitGuard` yapısını paylaşımlı bir depoya (Redis) taşıyarak IP+Route ve Mağaza/Token bazlı kotalar tanımlanmalı. Yazma (POST) işlemleri için daha düşük limitler ve burst (anlık yoğunluk) kontrolleri eklenmeli. `x-forwarded-for` gibi proxy başlıkları güvenilir kaynaklardan doğrulanarak IP tespiti yapılmalı.
2. **Varsayılan Domain Zorunluluğu:** Prod ortamında `ENABLE_TOKEN_DOMAIN_BINDING` ve `ENABLE_EMBED_DOMAIN_CHECK` varsayılan olarak aktif edilmeli. İzin listesi doluysa mutlaka Origin/Referer başlığı aranmalı.
3. **Token Yaşam Döngüsü:** Secret anahtarlarının belirli periyotlarla rotasyonu sağlanmalı. TTL süresi (örn. 5-10 dk) daha da kısaltılabilir. Loglarda asla slug/domain/token içeriği açıkça basılmamalı.
4. **Widget Key Hijyeni:** Şüpheli aktivitelerde (örn. izin verilmeyen bir domainden yoğun istek) widget key'in otomatik devre dışı bırakılması veya kullanıcıya uyarı gitmesi sağlanmalı.
5. **Transport ve Header Güvenliği:** Embed scriptleri sadece HTTPS üzerinden sunulmalı. Public API rotalarında CORS ayarları sıkılaştırılmalı (sadece kayıtlı domainlere izin verilmeli).
6. **İzleme ve Audit:** Reddedilen istekler, rate-limit'e takılan IP'ler ve hatalı token denemeleri için yapılandırılmış audit logları tutulmalı ve sistem yöneticileri için uyarı panelleri (alerting) oluşturulmalı.
