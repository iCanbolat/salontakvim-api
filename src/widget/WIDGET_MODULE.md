# 🎨 Widget Module

## 📋 Genel Bakış

Widget modülü, mağazaların web sitelerine yerleştirebilecekleri özelleştirilebilir randevu widget'ları sağlar. Bu modül, widget yapılandırması, embed kod oluşturma, genel API ve widget özelleştirme özelliklerini içerir.

- **Durum:** ✅ Aktif
- **Endpoint Sayısı:** 9
- **Genel Erişim:** Evet (Bazı endpoint'ler)

## 🎯 Özellikler

- ✅ **Widget Yapılandırması** - Özelleştirilebilir widget ayarları
- ✅ **Embed Kod Oluşturma** - Otomatik JavaScript embed kodu
- ✅ **Güvenli Widget Key** - Her mağaza için benzersiz widget anahtarı
- ✅ **Renk Özelleştirme** - Marka renklerine uygun tema
- ✅ **Font Seçimi** - Google Fonts desteği
- ✅ **Layout Seçenekleri** - Modal, Sidebar, Inline düzenler
- ✅ **Menü Özelleştirme** - Widget menü öğelerini özelleştirme
- ✅ **Genel API** - Widget key ile randevu oluşturma
- ✅ **Hizmet/Personel Listesi** - Widget için genel veri endpoint'leri
- ✅ **Responsive Tasarım** - Tüm cihazlarda çalışır

## 📂 Proje Yapısı

```
src/widget/
├── widget.controller.ts          # Widget endpoint'leri
├── widget.module.ts               # Widget modül yapılandırması
├── services/
│   └── widget.service.ts          # Widget iş mantığı
├── repositories/
│   └── widget-settings.repository.ts  # Widget DB işlemleri
├── dto/
│   └── widget.dto.ts              # Widget DTO'ları
├── exceptions/
│   ├── widget.exceptions.ts       # Widget özel exception'ları
│   └── index.ts                   # Exception exports
└── interfaces/
    └── widget.interface.ts        # Widget arayüzleri
```

## 🔌 API Endpoints

### 1. Get Widget Settings (Admin)

Mağaza için mevcut widget ayarlarını getirir.

**Endpoint:** `GET /widget/settings`  
**Auth:** JWT Required (Admin/Staff)  
**Response:**

```json
{
  "id": "widget-uuid",
  "storeId": "store-uuid",
  "widgetKey": "wk_1234567890abcdef",
  "isEnabled": true,
  "theme": {
    "primaryColor": "#FF6B6B",
    "secondaryColor": "#4ECDC4",
    "backgroundColor": "#FFFFFF",
    "textColor": "#2C3E50",
    "fontFamily": "Inter"
  },
  "layout": "modal",
  "menuItems": {
    "showServices": true,
    "showStaff": true,
    "showLocations": true,
    "showCalendar": true
  },
  "texts": {
    "title": "Randevu Al",
    "subtitle": "Hizmet seçerek başlayın",
    "buttonText": "Randevu Oluştur"
  },
  "redirectUrl": "https://example.com/tesekkurler",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-20T15:30:00Z"
}
```

### 2. Update Widget Settings (Admin)

Widget ayarlarını günceller.

**Endpoint:** `PUT /widget/settings`  
**Auth:** JWT Required (Admin)  
**Request Body:**

```json
{
  "isEnabled": true,
  "theme": {
    "primaryColor": "#FF6B6B",
    "secondaryColor": "#4ECDC4",
    "backgroundColor": "#FFFFFF",
    "textColor": "#2C3E50",
    "fontFamily": "Poppins"
  },
  "layout": "sidebar",
  "menuItems": {
    "showServices": true,
    "showStaff": true,
    "showLocations": false,
    "showCalendar": true
  },
  "texts": {
    "title": "Hemen Randevu Alın",
    "subtitle": "İstediğiniz hizmeti seçin",
    "buttonText": "Randevunu Oluştur"
  },
  "redirectUrl": "https://example.com/randevu-onay"
}
```

**Response:**

```json
{
  "message": "Widget ayarları başarıyla güncellendi",
  "settings": {
    /* Updated settings */
  }
}
```

### 3. Regenerate Widget Key (Admin)

Widget anahtarını yeniden oluşturur (eski widget'lar çalışmaz).

**Endpoint:** `POST /widget/regenerate-key`  
**Auth:** JWT Required (Admin)  
**Response:**

```json
{
  "message": "Widget anahtarı yenilendi",
  "widgetKey": "wk_newkey1234567890",
  "warning": "Eski widget anahtarı artık çalışmayacak"
}
```

### 4. Get Embed Code (Admin)

Widget için JavaScript embed kodunu döner.

**Endpoint:** `GET /widget/embed-code`  
**Auth:** JWT Required (Admin)  
**Response:**

```json
{
  "widgetKey": "wk_1234567890abcdef",
  "embedCode": "<script src=\"https://api.salontakvim.com/widget.js\" data-widget-key=\"wk_1234567890abcdef\"></script>",
  "instructions": "Bu kodu web sitenizin </body> etiketinden önce yapıştırın"
}
```

### 5. Get Services (Public - Widget API)

Widget için hizmet listesini getirir (genel erişim).

**Endpoint:** `GET /widget/public/:widgetKey/services`  
**Auth:** None (Public)  
**Response:**

```json
{
  "services": [
    {
      "id": "service-uuid",
      "name": "Saç Kesimi",
      "description": "Profesyonel saç kesimi hizmeti",
      "price": 150,
      "duration": 30,
      "categoryName": "Saç Bakımı",
      "image": "https://cdn.example.com/service1.jpg"
    }
  ]
}
```

### 6. Get Staff (Public - Widget API)

Widget için personel listesini getirir.

**Endpoint:** `GET /widget/public/:widgetKey/staff`  
**Auth:** None (Public)  
**Query Parameters:**

- `serviceId` (optional): Belirli bir hizmet için personel filtrele

**Response:**

```json
{
  "staff": [
    {
      "id": "staff-uuid",
      "name": "Ahmet Yılmaz",
      "title": "Kuaför",
      "avatar": "https://cdn.example.com/avatar1.jpg",
      "services": ["service-uuid-1", "service-uuid-2"]
    }
  ]
}
```

### 7. Get Available Time Slots (Public - Widget API)

Belirli bir tarih için müsait zaman dilimlerini getirir.

**Endpoint:** `GET /widget/public/:widgetKey/availability`  
**Auth:** None (Public)  
**Query Parameters:**

- `serviceId` (required): Hizmet ID
- `staffId` (optional): Personel ID
- `date` (required): Tarih (YYYY-MM-DD)

**Response:**

```json
{
  "date": "2024-02-15",
  "slots": [
    {
      "time": "09:00",
      "available": true,
      "staffId": "staff-uuid"
    },
    {
      "time": "09:30",
      "available": true,
      "staffId": "staff-uuid"
    },
    {
      "time": "10:00",
      "available": false,
      "staffId": "staff-uuid"
    }
  ]
}
```

### 8. Create Appointment (Public - Widget API)

Widget üzerinden randevu oluşturur.

**Endpoint:** `POST /widget/public/:widgetKey/appointments`  
**Auth:** None (Public)  
**Request Body:**

```json
{
  "serviceId": "service-uuid",
  "staffId": "staff-uuid",
  "locationId": "location-uuid",
  "date": "2024-02-15",
  "time": "09:00",
  "customer": {
    "name": "Ali Veli",
    "email": "ali@example.com",
    "phone": "+905551234567"
  },
  "notes": "Pencere kenarı tercih ederim"
}
```

**Response:**

```json
{
  "message": "Randevunuz başarıyla oluşturuldu",
  "appointment": {
    "id": "appointment-uuid",
    "confirmationCode": "RND-123456",
    "serviceName": "Saç Kesimi",
    "staffName": "Ahmet Yılmaz",
    "date": "2024-02-15",
    "time": "09:00",
    "duration": 30,
    "price": 150
  }
}
```

### 9. Get Locations (Public - Widget API)

Widget için lokasyon listesini getirir.

**Endpoint:** `GET /widget/public/:widgetKey/locations`  
**Auth:** None (Public)  
**Response:**

```json
{
  "locations": [
    {
      "id": "location-uuid",
      "name": "Merkez Şube",
      "address": "Atatürk Cad. No:123, İstanbul",
      "phone": "+902121234567",
      "isActive": true
    }
  ]
}
```

## 💾 Database Schema

### Widget Settings Table

```typescript
{
  id: uuid (PK)
  storeId: uuid (FK -> stores.id, UNIQUE)
  widgetKey: varchar(255, UNIQUE)      // Örn: "wk_abc123def456"
  isEnabled: boolean (default: true)

  // Theme Settings
  primaryColor: varchar(7)             // HEX format: #FF6B6B
  secondaryColor: varchar(7)
  backgroundColor: varchar(7)
  textColor: varchar(7)
  fontFamily: varchar(100)             // Google Fonts

  // Layout
  layout: enum('modal', 'sidebar', 'inline')

  // Menu Items (JSON)
  menuItems: {
    showServices: boolean
    showStaff: boolean
    showLocations: boolean
    showCalendar: boolean
  }

  // Custom Texts (JSON)
  texts: {
    title: string
    subtitle: string
    buttonText: string
  }

  // Redirect
  redirectUrl: varchar(500)            // Randevu sonrası yönlendirme

  createdAt: timestamp
  updatedAt: timestamp
}

Indexes:
- widgetKey (UNIQUE)
- storeId (UNIQUE)
```

## 🔐 İş Kuralları

### Widget Key Kuralları

- ✅ Her mağazanın benzersiz bir widget anahtarı var
- ✅ Widget anahtarı `wk_` prefix ile başlar
- ✅ Anahtar 32 karakter uzunluğunda random string
- ✅ Regenerate yapılınca eski anahtar devre dışı kalır
- ⚠️ Widget anahtarını güvenli tutun (public API'de kullanılır)

### Tema Kuralları

- ✅ Renkler HEX formatında olmalı (#RRGGBB)
- ✅ Font, Google Fonts listesinden seçilmeli
- ✅ Layout: modal, sidebar veya inline olabilir
- ✅ Menü öğeleri true/false ile kontrol edilir

### Genel API Kuralları

- ✅ Widget API endpoint'leri authentication gerektirmez
- ✅ Widget key ile store doğrulaması yapılır
- ✅ Widget devre dışıysa (isEnabled: false) API çalışmaz
- ✅ Rate limiting uygulanır (public endpoint'ler için)
- ✅ CORS ayarları widget domain'lerine açık

### Randevu Oluşturma Kuralları

- ✅ Müşteri bilgileri zorunlu (ad, email, telefon)
- ✅ Email ve telefon doğrulaması yapılır
- ✅ Seçilen zaman dilimi müsait olmalı
- ✅ Personel ve hizmet uyumlu olmalı
- ✅ Confirmation code otomatik oluşturulur

## 🧪 Hata Yönetimi

### Custom Exceptions

```typescript
// Widget ayarları bulunamazsa
throw new WidgetSettingsNotFoundException(storeId);

// Widget key geçersizse
throw new InvalidWidgetKeyException();

// Widget devre dışıysa
throw new WidgetDisabledException(storeId);

// Renk formatı yanlışsa
throw new InvalidWidgetColorException('primaryColor', '#GGGGGG');

// Layout geçersizse
throw new InvalidWidgetLayoutException('invalid-layout');

// Redirect URL geçersizse
throw new InvalidWidgetRedirectUrlException('invalid-url');
```

## 🚀 Kullanım Örnekleri

### Admin Tarafı - Widget Ayarlarını Güncelleme

```typescript
// Widget ayarlarını getir
const settings = await widgetService.getSettings(storeId);

// Ayarları güncelle
const updatedSettings = await widgetService.updateSettings(storeId, {
  isEnabled: true,
  theme: {
    primaryColor: '#FF6B6B',
    secondaryColor: '#4ECDC4',
    backgroundColor: '#FFFFFF',
    textColor: '#2C3E50',
    fontFamily: 'Inter',
  },
  layout: 'modal',
  menuItems: {
    showServices: true,
    showStaff: true,
    showLocations: true,
    showCalendar: true,
  },
});
```

### Admin Tarafı - Embed Kodu Alma

```typescript
// Embed kodunu al
const embedData = await widgetService.getEmbedCode(storeId);

// Müşteriye göster
console.log('Web sitenize ekleyin:');
console.log(embedData.embedCode);
// Output:
// <script src="https://api.salontakvim.com/widget.js"
//         data-widget-key="wk_1234567890abcdef"></script>
```

### Widget Tarafı - Randevu Oluşturma

```typescript
// Widget üzerinden randevu oluştur (public API)
const appointment = await fetch('/widget/public/wk_abc123/appointments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceId: 'service-uuid',
    staffId: 'staff-uuid',
    date: '2024-02-15',
    time: '09:00',
    customer: {
      name: 'Ali Veli',
      email: 'ali@example.com',
      phone: '+905551234567'
    }
  })
});

// Başarılı response
{
  "message": "Randevunuz başarıyla oluşturuldu",
  "appointment": {
    "confirmationCode": "RND-123456",
    // ... diğer bilgiler
  }
}
```

### Widget Integration - Frontend

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Kuaför Salonu</title>
  </head>
  <body>
    <h1>Hoş Geldiniz</h1>
    <p>Online randevu almak için butona tıklayın</p>

    <!-- Widget Button -->
    <button id="appointment-btn">Randevu Al</button>

    <!-- Widget Script -->
    <script
      src="https://api.salontakvim.com/widget.js"
      data-widget-key="wk_1234567890abcdef"
      data-layout="modal"
      data-trigger="#appointment-btn"
    ></script>
  </body>
</html>
```

## 🔮 Gelecek Geliştirmeler

- [ ] **Widget Analytics** - Widget üzerinden kaç randevu oluşturuldu
- [ ] **A/B Testing** - Farklı tema ve layout'ları test etme
- [ ] **Custom CSS** - Özel CSS ekleme desteği
- [ ] **Multi-Language** - Widget çoklu dil desteği
- [ ] **Webhook'lar** - Randevu oluşturulunca webhook tetikleme
- [ ] **Widget Preview** - Admin panelinde canlı önizleme
- [ ] **Spam Protection** - reCAPTCHA entegrasyonu
- [ ] **WhatsApp Widget** - WhatsApp üzerinden randevu
- [ ] **Calendar View** - Widget'ta takvim görünümü
- [ ] **Package Booking** - Paket hizmet randevuları

## 📞 Özet

Widget modülü, mağazaların web sitelerine entegre edebilecekleri tamamen özelleştirilebilir bir randevu widget'ı sağlar. Public API endpoint'leri sayesinde authentication olmadan randevu oluşturulabilir. Her mağaza için benzersiz widget key ile güvenlik sağlanır. Tema, layout ve menü öğeleri tamamen özelleştirilebilir.

**Ana Özellikler:**

- 🎨 Özelleştirilebilir tema (renkler, fontlar)
- 📱 Responsive tasarım (mobil uyumlu)
- 🔐 Güvenli widget key sistemi
- 🚀 Kolay entegrasyon (tek satır kod)
- 📊 Hizmet/personel/lokasyon listeleme
- ⏰ Müsait saat kontrolü
- 📝 Misafir randevu oluşturma
- 🔄 Redirect desteği

**Teknik Detaylar:**

- 9 endpoint (4 admin, 5 public)
- Widget key ile store doğrulama
- Rate limiting ve CORS koruması
- Google Fonts entegrasyonu
- JSON tabanlı konfigürasyon
