# 🏪 Stores Module

## 📋 Genel Bakış

Stores modülü, çok kiracılı (multi-tenant) mağaza yönetimi sağlar. Her kullanıcı (admin) bir mağaza oluşturabilir ve bu mağaza altında tüm işlemlerini yönetebilir. Bu modül, mağaza oluşturma, güncelleme, silme ve analitik işlemlerini içerir.

- **Durum:** ✅ Aktif
- **Endpoint Sayısı:** 8
- **Multi-Tenant:** Evet

## 🎯 Özellikler

- ✅ **Tek Mağaza Kuralı** - Her kullanıcı bir mağaza oluşturabilir
- ✅ **Otomatik Slug Oluşturma** - SEO dostu URL'ler
- ✅ **Slug Benzersizliği** - Her slug unique olmalı
- ✅ **Mağaza Sahipliği Kontrolü** - Sadece sahip erişebilir
- ✅ **Aktif/Pasif Durum** - Mağaza aktif/pasif yapılabilir
- ✅ **Mağaza Analitiği** - Toplam istatistikler
- ✅ **Otomatik Mağaza Oluşturma** - Kayıt sırasında otomatik oluşturulur
- ✅ **Soft Delete** - Mağazalar fiziksel olarak silinmez
- ✅ **Bağımlılık Kontrolü** - Aktif veriler varsa silme engellenir

## 📂 Proje Yapısı

```
src/stores/
├── store.controller.ts           # Store endpoint'leri
├── store.module.ts                # Store modül yapılandırması
├── services/
│   └── store.service.ts           # Store iş mantığı
├── repositories/
│   └── store.repository.ts        # Store DB işlemleri
├── dto/
│   └── store.dto.ts               # Store DTO'ları
├── exceptions/
│   ├── store.exceptions.ts        # Store özel exception'ları
│   └── index.ts                   # Exception exports
└── interfaces/
    └── store.interface.ts         # Store arayüzleri
```

## 🔌 API Endpoints

### 1. Create Store

Yeni mağaza oluşturur (kullanıcı başına bir mağaza).

**Endpoint:** `POST /stores`  
**Auth:** JWT Required (Admin role)  
**Request Body:**

```json
{
  "name": "Elit Kuaför Salonu",
  "slug": "elit-kuafor",
  "description": "İstanbul'un en iyi kuaför salonu",
  "contactEmail": "info@elitkuafor.com",
  "contactPhone": "+902121234567",
  "address": "Bağdat Cad. No:123 Kadıköy/İstanbul",
  "taxNumber": "1234567890",
  "taxOffice": "Kadıköy Vergi Dairesi",
  "logo": "https://cdn.example.com/logo.png",
  "coverImage": "https://cdn.example.com/cover.jpg",
  "settings": {
    "timezone": "Europe/Istanbul",
    "currency": "TRY",
    "language": "tr"
  }
}
```

**Response:**

```json
{
  "message": "Mağaza başarıyla oluşturuldu",
  "store": {
    "id": "store-uuid",
    "name": "Elit Kuaför Salonu",
    "slug": "elit-kuafor",
    "ownerId": "user-uuid",
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

**Errors:**

- `409 Conflict` - Kullanıcının zaten bir mağazası var
- `409 Conflict` - Slug zaten kullanımda
- `400 Bad Request` - Geçersiz mağaza adı

### 2. Get My Store

Mevcut kullanıcının mağazasını getirir.

**Endpoint:** `GET /stores/my-store`  
**Auth:** JWT Required (Admin/Staff)  
**Response:**

```json
{
  "id": "store-uuid",
  "name": "Elit Kuaför Salonu",
  "slug": "elit-kuafor",
  "description": "İstanbul'un en iyi kuaför salonu",
  "ownerId": "user-uuid",
  "contactEmail": "info@elitkuafor.com",
  "contactPhone": "+902121234567",
  "address": "Bağdat Cad. No:123 Kadıköy/İstanbul",
  "taxNumber": "1234567890",
  "taxOffice": "Kadıköy Vergi Dairesi",
  "logo": "https://cdn.example.com/logo.png",
  "coverImage": "https://cdn.example.com/cover.jpg",
  "isActive": true,
  "settings": {
    "timezone": "Europe/Istanbul",
    "currency": "TRY",
    "language": "tr"
  },
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-20T15:30:00Z"
}
```

**Errors:**

- `404 Not Found` - Kullanıcının mağazası yok

### 3. Get Store by ID

Mağazayı ID ile getirir.

**Endpoint:** `GET /stores/:id`  
**Auth:** JWT Required (Admin/Staff - sadece kendi mağazası)  
**Response:** (Get My Store ile aynı)

**Errors:**

- `404 Not Found` - Mağaza bulunamadı
- `403 Forbidden` - Bu mağazaya erişim yetkiniz yok

### 4. Get Store by Slug (Public)

Mağazayı slug ile getirir (genel erişim).

**Endpoint:** `GET /stores/slug/:slug`  
**Auth:** None (Public)  
**Response:**

```json
{
  "id": "store-uuid",
  "name": "Elit Kuaför Salonu",
  "slug": "elit-kuafor",
  "description": "İstanbul'un en iyi kuaför salonu",
  "contactEmail": "info@elitkuafor.com",
  "contactPhone": "+902121234567",
  "address": "Bağdat Cad. No:123 Kadıköy/İstanbul",
  "logo": "https://cdn.example.com/logo.png",
  "coverImage": "https://cdn.example.com/cover.jpg",
  "isActive": true,
  "settings": {
    "timezone": "Europe/Istanbul",
    "currency": "TRY",
    "language": "tr"
  }
}
```

**Errors:**

- `404 Not Found` - Mağaza bulunamadı

### 5. Update Store

Mağaza bilgilerini günceller.

**Endpoint:** `PUT /stores/:id`  
**Auth:** JWT Required (Admin - sadece kendi mağazası)  
**Request Body:**

```json
{
  "name": "Elit Premium Kuaför",
  "description": "Yenilenmiş açıklama",
  "contactEmail": "yeni@elitkuafor.com",
  "contactPhone": "+902121234568",
  "address": "Yeni adres",
  "logo": "https://cdn.example.com/new-logo.png",
  "settings": {
    "timezone": "Europe/Istanbul",
    "currency": "TRY",
    "language": "tr"
  }
}
```

**Response:**

```json
{
  "message": "Mağaza başarıyla güncellendi",
  "store": {
    /* Updated store data */
  }
}
```

**Errors:**

- `404 Not Found` - Mağaza bulunamadı
- `403 Forbidden` - Bu mağazayı güncelleme yetkiniz yok
- `409 Conflict` - Slug zaten kullanımda (slug değiştirildiyse)

### 6. Deactivate Store

Mağazayı pasif yapar (soft disable).

**Endpoint:** `PATCH /stores/:id/deactivate`  
**Auth:** JWT Required (Admin - sadece kendi mağazası)  
**Response:**

```json
{
  "message": "Mağaza başarıyla devre dışı bırakıldı",
  "store": {
    "id": "store-uuid",
    "isActive": false
  }
}
```

**Errors:**

- `404 Not Found` - Mağaza bulunamadı
- `403 Forbidden` - Bu mağazayı devre dışı bırakma yetkiniz yok

### 7. Delete Store

Mağazayı siler (soft delete).

**Endpoint:** `DELETE /stores/:id`  
**Auth:** JWT Required (Admin - sadece kendi mağazası)  
**Response:**

```json
{
  "message": "Mağaza başarıyla silindi"
}
```

**Errors:**

- `404 Not Found` - Mağaza bulunamadı
- `403 Forbidden` - Bu mağazayı silme yetkiniz yok
- `409 Conflict` - Mağazanın aktif bağımlılıkları var (randevular, personel vb.)

### 8. Get Store Analytics

Mağaza istatistiklerini getirir.

**Endpoint:** `GET /stores/:id/analytics`  
**Auth:** JWT Required (Admin - sadece kendi mağazası)  
**Response:**

```json
{
  "storeId": "store-uuid",
  "storeName": "Elit Kuaför Salonu",
  "analytics": {
    "totalAppointments": 1250,
    "totalRevenue": 125000,
    "totalCustomers": 450,
    "totalServices": 25,
    "totalStaff": 8,
    "totalLocations": 2,
    "activeAppointments": 15,
    "completedAppointments": 1150,
    "cancelledAppointments": 85,
    "averageRating": 4.7,
    "totalReviews": 320
  },
  "monthlyStats": {
    "currentMonth": {
      "appointments": 85,
      "revenue": 8500,
      "newCustomers": 12
    },
    "lastMonth": {
      "appointments": 92,
      "revenue": 9200,
      "newCustomers": 15
    },
    "growth": {
      "appointments": -7.6,
      "revenue": -7.6,
      "newCustomers": -20.0
    }
  }
}
```

**Errors:**

- `404 Not Found` - Mağaza bulunamadı
- `403 Forbidden` - Bu mağazanın istatistiklerini görme yetkiniz yok

## 💾 Database Schema

### Stores Table

```typescript
{
  id: uuid (PK)
  name: varchar(255)
  slug: varchar(255, UNIQUE)
  description: text
  ownerId: uuid (FK -> users.id)

  // Contact Info
  contactEmail: varchar(255)
  contactPhone: varchar(20)
  address: text

  // Business Info
  taxNumber: varchar(20)
  taxOffice: varchar(255)

  // Media
  logo: varchar(500)
  coverImage: varchar(500)

  // Status
  isActive: boolean (default: true)

  // Settings (JSON)
  settings: {
    timezone: string        // Örn: "Europe/Istanbul"
    currency: string        // Örn: "TRY"
    language: string        // Örn: "tr"
    workingDays: string[]   // Örn: ["monday", "tuesday", ...]
    workingHours: {
      start: string         // Örn: "09:00"
      end: string           // Örn: "18:00"
    }
  }

  // Soft Delete
  deletedAt: timestamp (nullable)

  createdAt: timestamp
  updatedAt: timestamp
}

Indexes:
- slug (UNIQUE)
- ownerId
- isActive
- deletedAt
```

## 🔐 İş Kuralları

### Mağaza Oluşturma Kuralları

- ✅ Her kullanıcı (admin role) sadece **bir mağaza** oluşturabilir
- ✅ Mağaza slug'ı **benzersiz** olmalı (tüm sistem genelinde)
- ✅ Slug otomatik oluşturulur (mağaza adından)
- ✅ Mağaza adı en az 3, en fazla 255 karakter olmalı
- ✅ Kayıt sırasında otomatik olarak mağaza oluşturulur

### Slug Kuralları

- ✅ Türkçe karakterler İngilizce karşılıklarına çevrilir
  - `ç -> c, ğ -> g, ı -> i, ö -> o, ş -> s, ü -> u`
- ✅ Boşluklar tire (-) ile değiştirilir
- ✅ Özel karakterler kaldırılır
- ✅ Küçük harfe çevrilir
- ✅ Örnek: "Elit Kuaför Salonu" -> "elit-kuafor-salonu"

### Sahiplik Kuralları

- ✅ Sadece mağaza sahibi (ownerId) kendi mağazasını düzenleyebilir
- ✅ Staff üyeleri sadece okuma yetkisine sahip
- ✅ Diğer admin'ler başka mağazalara erişemez
- ⚠️ Super admin varsa tüm mağazalara erişebilir (gelecek özellik)

### Silme Kuralları

- ✅ Mağaza soft delete ile silinir (deletedAt set edilir)
- ✅ Aktif randevuları olan mağaza silinemez
- ✅ Aktif personeli olan mağaza silinemez
- ✅ Aktif hizmetleri olan mağaza silinemez
- ⚠️ Tüm bağımlılıklar kontrol edilir

### Multi-Tenant İzolasyon

- ✅ Tüm modüller (services, staff, appointments vb.) storeId ile filtrelenir
- ✅ Bir mağazanın verisi başka mağazaya görünmez
- ✅ API endpoint'lerinde otomatik mağaza kontrolü yapılır
- ✅ Database query'lerinde her zaman `WHERE storeId = ?` koşulu eklenir

## 🧪 Hata Yönetimi

### Custom Exceptions

```typescript
// Mağaza bulunamazsa
throw new StoreNotFoundException(storeId);

// Slug zaten kullanımdaysa
throw new StoreSlugAlreadyExistsException('elit-kuafor');

// Kullanıcının zaten mağazası varsa
throw new UserAlreadyHasStoreException(userId);

// Yetkisiz erişim
throw new UnauthorizedStoreAccessException(storeId, userId);

// Mağaza aktif değilse
throw new StoreInactiveException(storeId);

// Aktif bağımlılıklar varsa
throw new StoreHasActiveDependenciesException(storeId, [
  'appointments',
  'staff',
]);

// Geçersiz mağaza adı
throw new InvalidStoreNameException('Ad en az 3 karakter olmalı');

// Limit aşımı
throw new StoreLimitReachedException(userId, 1);
```

## 🚀 Kullanım Örnekleri

### Kayıt Sırasında Otomatik Mağaza Oluşturma

```typescript
// AuthService.register() içinde
async register(dto: RegisterDto) {
  // Kullanıcı oluştur
  const user = await this.userRepository.create({
    email: dto.email,
    password: hashedPassword,
    role: UserRole.ADMIN
  });

  // Otomatik mağaza oluştur
  const store = await this.storeService.create(user.id, {
    name: dto.storeName || `${dto.email.split('@')[0]}'in Mağazası`,
    // Diğer varsayılan değerler...
  });

  return { user, store };
}
```

### Mağaza Sahipliği Kontrolü (Guard/Decorator)

```typescript
// StoreOwnerGuard
@Injectable()
export class StoreOwnerGuard implements CanActivate {
  constructor(private storeService: StoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const storeId = request.params.id;

    const store = await this.storeService.findById(storeId);

    if (!store) {
      throw new StoreNotFoundException(storeId);
    }

    if (store.ownerId !== user.id) {
      throw new UnauthorizedStoreAccessException(storeId, user.id);
    }

    return true;
  }
}

// Controller'da kullanım
@Put(':id')
@UseGuards(JwtAuthGuard, StoreOwnerGuard)
async updateStore(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
  return this.storeService.update(id, dto);
}
```

### Multi-Tenant Veri Filtreleme

```typescript
// ServiceRepository.findAll() örneği
async findAll(storeId: string) {
  // Her zaman storeId ile filtrele
  return this.db.query.services.findMany({
    where: eq(services.storeId, storeId)
  });
}

// Controller'da kullanım
@Get()
async getServices(@CurrentUser() user: IUser) {
  // Kullanıcının mağazasını al
  const store = await this.storeService.findByOwnerId(user.id);

  // Sadece bu mağazanın hizmetlerini getir
  return this.serviceService.findAll(store.id);
}
```

### Mağaza Analytics Hesaplama

```typescript
async getAnalytics(storeId: string) {
  // Store'un var olduğunu kontrol et
  const store = await this.findById(storeId);

  // Paralel olarak tüm istatistikleri al
  const [
    totalAppointments,
    totalRevenue,
    totalCustomers,
    totalServices,
    totalStaff,
    totalLocations
  ] = await Promise.all([
    this.appointmentRepo.count(storeId),
    this.appointmentRepo.sumRevenue(storeId),
    this.customerRepo.countUnique(storeId),
    this.serviceRepo.count(storeId),
    this.staffRepo.count(storeId),
    this.locationRepo.count(storeId)
  ]);

  return {
    storeId: store.id,
    storeName: store.name,
    analytics: {
      totalAppointments,
      totalRevenue,
      totalCustomers,
      totalServices,
      totalStaff,
      totalLocations
    }
  };
}
```

## 🔮 Gelecek Geliştirmeler

- [ ] **Multi-Store Support** - Bir kullanıcı birden fazla mağaza (plan bazlı)
- [ ] **Store Themes** - Mağazaya özel tema renkleri
- [ ] **Custom Domain** - Mağazaya özel domain (store.example.com)
- [ ] **Store Analytics Dashboard** - Detaylı grafik ve raporlar
- [ ] **Store Settings API** - Genişletilmiş ayarlar
- [ ] **Store Subscription** - Abonelik paketleri (basic, premium, enterprise)
- [ ] **Store Templates** - Hazır mağaza şablonları
- [ ] **Store Export** - Mağaza verilerini dışa aktarma
- [ ] **Store Transfer** - Mağaza sahipliğini devretme
- [ ] **Store Reviews** - Mağaza değerlendirmeleri

## 📞 Özet

Stores modülü, çok kiracılı (multi-tenant) mağaza yönetimi sağlayan ana modüldür. Her kullanıcı bir mağaza oluşturabilir ve tüm işlemlerini bu mağaza altında yönetir. Slug-based routing ile SEO dostu URL'ler desteklenir. Mağaza sahipliği kontrolü ile güvenlik sağlanır.

**Ana Özellikler:**

- 🏪 Tek mağaza kuralı (kullanıcı başına)
- 🔐 Sahiplik kontrolü ve yetkilendirme
- 🌐 SEO dostu slug sistemi
- 📊 Mağaza analitiği ve istatistikler
- 🔄 Otomatik mağaza oluşturma (kayıt sırasında)
- 🗑️ Soft delete ve bağımlılık kontrolü
- 🎨 Özelleştirilebilir ayarlar (JSON)
- 🌍 Multi-language ve timezone desteği

**Teknik Detaylar:**

- 8 endpoint (7 korumalı, 1 public)
- Multi-tenant veri izolasyonu
- Otomatik slug oluşturma ve validasyon
- Comprehensive analytics calculation
- Bağımlılık kontrolü (cascade delete prevention)
