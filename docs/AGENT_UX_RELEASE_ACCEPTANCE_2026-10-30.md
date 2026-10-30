# Academy — canlı yayın ve kabul raporu

30 Ekim 2026. Kullanıcı, bekleyen gerçek veritabanı entegrasyonu ve canlı yayın/kabul adımlarını açıkça onayladı.

## Yayın sonucu

**Yedi düzeltme canlıda.** Ürün kaynak commit'i `064ae4cf10ad3bc8d4a4de1c2ecda243ed4a5321`; yayın zamanı `2026-10-30T09:06:59Z`.

- Hedef: `academy.findandstudy.com`, VPS `187.126.20.140`, yalnız `academy160-academy` uygulaması.
- Yayın öncesi 225 mevcut kaynak dosyası GitHub tabanıyla tekrar eşlendi. 12 incelenmiş kaynak dosyası ve derlenmiş paket aktarıldı.
- Paket SHA-256: `88ad666f2dc6778a3056e075bcdb8939460a0ee5583dfd4d9a827c1e523af7ad`.
- Canlı sunucu paketi SHA-256: `4d863f57ed54a390d8e89e735cef6e55d0b5267f951a3e947403a1a94a1c6577`.
- Geri dönüş paketi sunucuda `/srv/academy-ux-20261030-064ae4c/rollback-application.tar` adresinde, yalnız sahibine açık izinlerle saklandı. Mevcut yüklemeler ve eski statik varlıklar korundu.
- Genel sağlık kontrolü HTTP 200 ve `status=ok`. Diğer sekiz ilgili konteynerin başlangıç zamanı aynı kaldı; yalnız Academy yeniden başladı.
- DNS, özel konfigürasyon, üretim şeması ve çalışan iki otomasyon süreci değiştirilmedi. Deponun eski otomatik DB-push içeren deploy betiği çalıştırılmadı.

## Gerçek PostgreSQL entegrasyonu

PostgreSQL 16.15 ve canlıyla aynı Node 22.23.4 sürümü kullanıldı. Ayrı, dış bağlantısı olmayan Docker ağı ve geçici PostgreSQL veri alanı kuruldu; production verisi/kimliği kullanılmadı. Şema yalnız bu disposable veritabanında oluşturuldu. Test sonunda test konteyneri ve ağı kaldırıldı.

`tests/agent-ux-postgres.integration.ts`, gerçek Express route kayıtlarını, session middleware'ini, authorization kontrollerini, Drizzle storage'ını ve PostgreSQL'i birlikte çalıştırdı. **18 kontrol PASS**:

- Oturumsuz ve yalnız sahte kullanıcı/rol başlıklı isteklerin reddi.
- İki acentenin kendi sertifikalarıyla sınırlı listeleri ve dinamik kurs başlığı.
- Acente için admin listesinin reddi; admin için iki sertifikanın doğru metadatası.
- Genel sertifika doğrulama ve bilinmeyen kod için 404.
- Kendi acentesinde ülke/şehir güncellemesi ve tekrar okuma.
- Başka acente kimliği, yönetim durumu, hatalı ülke ve aşırı uzun şehir gönderiminin reddi.
- Başka acentenin değişmediğinin SQL ile doğrulanması; pasif kullanıcının reddi.
- Test sertifikalarının yeniden üretilmediğinin kontrolü.

Harness oturumu yalnız izole test sunucusunda oluşturur; production paketine test giriş yolu eklenmedi. Bu test gerçek kullanıcı parolası veya yeni SSO giriş seremonisi değildir.

## Canlı veritabanı ve kabul

Yayın öncesi/sonrası üretim sorguları `BEGIN READ ONLY` ve 5 saniyelik sorgu bütçesiyle çalıştı. Aynı PostgreSQL sunucusu/veritabanı doğrulandı. Sayılar aynı kaldı: **342 kullanıcı, 44 acente, 14 sertifika, 515 içerik**. Sertifikaların kimlik/kod/not/tarih alanlarından alınan aggregate fingerprint değişmedi. 14 sertifikanın tamamı ülkeye bağlı bir kurs kimliğiyle çözülebiliyor; bilinmeyen kurs sayısı 0.

Gerçek acente oturumunda:

| Kontrol | Sonuç |
|---|---|
| Yenileme sonrası oturum | Korundu; tekrar giriş gerekmedi. |
| Findy / Devam | İki gerçek Devam düğmesinin merkezindeki hedef doğru kurs bağlantısı. Sohbet açılıp kapandı; mesaj gönderilmedi. |
| Letonya'ya devam | Letonya ve ilk tamamlanmamış `Popular Fields of Study in Latvia` dersi açıldı. |
| Mobil gerçek içerik | 390px genişlikte içerik üstü 80px, yatay taşma yok. Quiz gerektiren tamamla düğmesi kilitli. |
| Sertifika | Gerçek sertifika kartında `Türkiye — Agent Training` göründü; PDF indirildi. |
| Genel doğrulama | Gerçek kod için Valid Certificate ve aynı kurs adı görüldü. |
| Bildirim tercihleri | Doğru menü/başlık ve mevcut dört anahtar görüntülendi; değerleri değiştirilmedi. |
| Acente bilgileri | Ülke/şehir alanları ve etiketleri görüntülendi; canlı profil verisine test değeri yazılmadı. |
| Menü | Mobil aç/kapat ve erişilebilir ad/expanded durumu doğrulandı. |
| Canlı negatif erişim | Sahte kullanıcı/rol başlığıyla iki korumalı okuma 401; bilinmeyen sertifika kodu 404. |

Kullanıcının sekmesi Partner Zone'a döndürüldü; geçici doğrulama sekmesi kapatıldı ve viewport ayarı sıfırlandı. Önceki 61 birim/regresyon testi, çeviri ve derleme kanıtları geçerlidir; ek entegrasyon testi TypeScript kontrolünden de geçti.

## Sınırlar

Bu kabul yedi değişikliğin kapsamındadır. Yeni parola/SSO giriş döngüsü, bütün rollerin tam yetki matrisi, gerçek sınav gönderimi, ödeme, partner başvurusu, e-posta teslimi veya AI cevap kalitesi için yeni bir başarı iddiası içermez. Ülke/şehir yazma testi disposable PostgreSQL'de yapıldı; canlı kullanıcı kaydı değiştirilmedi. Yerel geri dönüş paketi offsite backup veya tam felaket kurtarma tatbikatı değildir.

PII içermeyen makine kanıtları yerel `academy-agent-audit-20261030` klasöründedir: `deployment-receipt.json`, `postgres-integration.log`, `post-release-comparison.json`, `live-http-negative-checks.json`, `live-browser-acceptance.json`. Ekran görüntüleri `live-fixed-*.png` olarak saklandı; kişisel sertifika ayrıntıları Git'e eklenmedi.
