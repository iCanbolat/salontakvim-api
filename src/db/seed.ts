/**
 * Database Seed Script
 * Seeds the database with test data for widget development
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // 1. Create Admin User (Store Owner)
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const [adminUser] = await db
      .insert(schema.users)
      .values({
        email: 'admin@salontakvim.com',
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
        phone: '+90 555 123 4567',
        password: hashedPassword,
        role: 'admin',
        paymentStatus: 'paid',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    console.log('✓ Admin user created:', adminUser.email);

    // 2. Create Store
    console.log('Creating store...');
    const [store] = await db
      .insert(schema.stores)
      .values({
        ownerId: adminUser.id,
        name: 'Güzellik Salonu',
        slug: 'guzellik-salonu',
        description: 'Premium güzellik ve bakım hizmetleri',
        email: 'info@guzelliklsalonu.com',
        phone: '+90 555 987 6543',
        currency: 'TRY',
        isActive: true,
      })
      .returning();

    console.log('✓ Store created:', store.name);

    // 3. Create Categories
    console.log('Creating categories...');
    const [hairCategory] = await db
      .insert(schema.categories)
      .values({
        storeId: store.id,
        name: 'Saç Bakımı',
        description: 'Saç kesimi, boyama ve bakım hizmetleri',
        color: '#FF6B6B',
        icon: 'Scissors',
        position: 0,
        isVisible: true,
      })
      .returning();

    const [skinCategory] = await db
      .insert(schema.categories)
      .values({
        storeId: store.id,
        name: 'Cilt Bakımı',
        description: 'Profesyonel cilt bakımı ve spa',
        color: '#4ECDC4',
        icon: 'Sparkles',
        position: 1,
        isVisible: true,
      })
      .returning();

    const [nailCategory] = await db
      .insert(schema.categories)
      .values({
        storeId: store.id,
        name: 'Tırnak Bakımı',
        description: 'Manikür, pedikür ve nail art',
        color: '#95E1D3',
        icon: 'Hand',
        position: 2,
        isVisible: true,
      })
      .returning();

    console.log('✓ Categories created: 3');

    // 4. Create Locations
    console.log('Creating locations...');
    const [location1] = await db
      .insert(schema.locations)
      .values({
        storeId: store.id,
        name: 'Merkez Şube',
        address: 'Bağdat Caddesi No:123 Kadıköy',
        city: 'İstanbul',
        state: 'İstanbul',
        zipCode: '34710',
        country: 'Türkiye',
        phone: '+90 555 111 2233',
        email: 'kadikoy@guzelliklsalonu.com',
        isVisible: true,
      })
      .returning();

    const [location2] = await db
      .insert(schema.locations)
      .values({
        storeId: store.id,
        name: 'Nişantaşı Şube',
        address: 'Teşvikiye Caddesi No:45 Şişli',
        city: 'İstanbul',
        state: 'İstanbul',
        zipCode: '34365',
        country: 'Türkiye',
        phone: '+90 555 444 5566',
        email: 'nisantasi@guzelliklsalonu.com',
        isVisible: true,
      })
      .returning();

    console.log('✓ Locations created: 2');

    // 5. Create Services
    console.log('Creating services...');

    // Hair Services
    const [haircut] = await db
      .insert(schema.services)
      .values({
        storeId: store.id,
        categoryId: hairCategory.id,
        name: 'Saç Kesimi',
        description: 'Profesyonel saç kesimi ve şekillendirme',
        duration: 45,
        price: '250.00',
        capacity: 1,
        bufferTimeBefore: 5,
        bufferTimeAfter: 10,
        color: '#FF6B6B',
        isVisible: true,
        showBringingAnyoneOption: false,
        allowRecurring: true,
        position: 0,
      })
      .returning();

    const [hairColor] = await db
      .insert(schema.services)
      .values({
        storeId: store.id,
        categoryId: hairCategory.id,
        name: 'Saç Boyama',
        description: 'Profesyonel boya ve renklendirme hizmeti',
        duration: 120,
        price: '850.00',
        capacity: 1,
        bufferTimeBefore: 10,
        bufferTimeAfter: 15,
        color: '#FF6B6B',
        isVisible: true,
        showBringingAnyoneOption: false,
        allowRecurring: false,
        position: 1,
      })
      .returning();

    const [hairTreatment] = await db
      .insert(schema.services)
      .values({
        storeId: store.id,
        categoryId: hairCategory.id,
        name: 'Saç Bakım Tedavisi',
        description: 'Keratin ve protein bakım tedavisi',
        duration: 90,
        price: '650.00',
        capacity: 1,
        bufferTimeBefore: 5,
        bufferTimeAfter: 10,
        color: '#FF6B6B',
        isVisible: true,
        showBringingAnyoneOption: false,
        allowRecurring: false,
        position: 2,
      })
      .returning();

    // Skin Services
    const [facial] = await db
      .insert(schema.services)
      .values({
        storeId: store.id,
        categoryId: skinCategory.id,
        name: 'Cilt Bakımı (Hydrafacial)',
        description: 'Derin temizlik ve nemlendirme',
        duration: 60,
        price: '750.00',
        capacity: 1,
        bufferTimeBefore: 10,
        bufferTimeAfter: 10,
        color: '#4ECDC4',
        isVisible: true,
        showBringingAnyoneOption: false,
        allowRecurring: true,
        position: 0,
      })
      .returning();

    const [massage] = await db
      .insert(schema.services)
      .values({
        storeId: store.id,
        categoryId: skinCategory.id,
        name: 'Rahatlatıcı Masaj',
        description: 'Aromaterapi masajı ve spa',
        duration: 75,
        price: '550.00',
        capacity: 1,
        bufferTimeBefore: 5,
        bufferTimeAfter: 15,
        color: '#4ECDC4',
        isVisible: true,
        showBringingAnyoneOption: true,
        allowRecurring: true,
        position: 1,
      })
      .returning();

    // Nail Services
    const [manicure] = await db
      .insert(schema.services)
      .values({
        storeId: store.id,
        categoryId: nailCategory.id,
        name: 'Manikür',
        description: 'El bakımı ve oje uygulaması',
        duration: 45,
        price: '200.00',
        capacity: 2,
        bufferTimeBefore: 5,
        bufferTimeAfter: 5,
        color: '#95E1D3',
        isVisible: true,
        showBringingAnyoneOption: true,
        allowRecurring: true,
        position: 0,
      })
      .returning();

    const [pedicure] = await db
      .insert(schema.services)
      .values({
        storeId: store.id,
        categoryId: nailCategory.id,
        name: 'Pedikür',
        description: 'Ayak bakımı ve oje uygulaması',
        duration: 60,
        price: '250.00',
        capacity: 2,
        bufferTimeBefore: 5,
        bufferTimeAfter: 5,
        color: '#95E1D3',
        isVisible: true,
        showBringingAnyoneOption: true,
        allowRecurring: true,
        position: 1,
      })
      .returning();

    const [gelNails] = await db
      .insert(schema.services)
      .values({
        storeId: store.id,
        categoryId: nailCategory.id,
        name: 'Kalıcı Oje (Gel)',
        description: 'Uzun ömürlü kalıcı oje uygulaması',
        duration: 50,
        price: '300.00',
        capacity: 2,
        bufferTimeBefore: 5,
        bufferTimeAfter: 5,
        color: '#95E1D3',
        isVisible: true,
        showBringingAnyoneOption: true,
        allowRecurring: false,
        position: 2,
      })
      .returning();

    console.log('✓ Services created: 9');

    // 6. Create Service Extras
    console.log('Creating service extras...');

    await db.insert(schema.serviceExtras).values([
      {
        serviceId: haircut.id,
        name: 'Saç Yıkama',
        description: 'Profesyonel şampuan ve bakım',
        price: '50.00',
        duration: 15,
        maxQuantity: 1,
        position: 0,
      },
      {
        serviceId: haircut.id,
        name: 'Fön',
        description: 'Föne çekme ve şekillendirme',
        price: '100.00',
        duration: 20,
        maxQuantity: 1,
        position: 1,
      },
      {
        serviceId: hairColor.id,
        name: 'Röfle',
        description: 'Profesyonel röfle tekniği',
        price: '350.00',
        duration: 30,
        maxQuantity: 1,
        position: 0,
      },
      {
        serviceId: facial.id,
        name: 'Göz Çevresi Bakımı',
        description: 'Özel göz çevresi maskesi',
        price: '150.00',
        duration: 15,
        maxQuantity: 1,
        position: 0,
      },
      {
        serviceId: manicure.id,
        name: 'El Masajı',
        description: 'Nemlendirici el masajı',
        price: '50.00',
        duration: 10,
        maxQuantity: 1,
        position: 0,
      },
    ]);

    console.log('✓ Service extras created: 5');

    // 7. Create Staff Members
    console.log('Creating staff members...');

    const [staff1User] = await db
      .insert(schema.users)
      .values({
        email: 'ayse@guzelliklsalonu.com',
        firstName: 'Ayşe',
        lastName: 'Demir',
        phone: '+90 555 222 3344',
        password: await bcrypt.hash('staff123', 10),
        role: 'staff',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    const [staff1] = await db
      .insert(schema.staffMembers)
      .values({
        userId: staff1User.id,
        storeId: store.id,
        locationId: location1.id,
        bio: '10 yıllık deneyimli kuaför. Saç kesimi ve boyama uzmanı.',
        title: 'Kuaför',
        isVisible: true,
      })
      .returning();

    const [staff2User] = await db
      .insert(schema.users)
      .values({
        email: 'mehmet@guzelliklsalonu.com',
        firstName: 'Mehmet',
        lastName: 'Kaya',
        phone: '+90 555 333 4455',
        password: await bcrypt.hash('staff123', 10),
        role: 'staff',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    const [staff2] = await db
      .insert(schema.staffMembers)
      .values({
        userId: staff2User.id,
        storeId: store.id,
        locationId: location1.id,
        bio: 'Cilt bakımı ve masaj terapisti. 8 yıllık profesyonel deneyim.',
        title: 'Cilt Bakım Uzmanı',
        isVisible: true,
      })
      .returning();

    const [staff3User] = await db
      .insert(schema.users)
      .values({
        email: 'zeynep@guzelliklsalonu.com',
        firstName: 'Zeynep',
        lastName: 'Şahin',
        phone: '+90 555 444 5566',
        password: await bcrypt.hash('staff123', 10),
        role: 'staff',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    const [staff3] = await db
      .insert(schema.staffMembers)
      .values({
        userId: staff3User.id,
        storeId: store.id,
        locationId: location2.id,
        bio: 'Tırnak bakımı ve nail art uzmanı. Yaratıcı tasarımlar.',
        title: 'Nail Art Uzmanı',
        isVisible: true,
      })
      .returning();

    console.log('✓ Staff members created: 3');

    // 8. Assign Services to Staff
    console.log('Assigning services to staff...');

    await db.insert(schema.serviceStaff).values([
      // Ayşe - Saç işlemleri
      { serviceId: haircut.id, staffId: staff1.id },
      { serviceId: hairColor.id, staffId: staff1.id },
      { serviceId: hairTreatment.id, staffId: staff1.id },

      // Mehmet - Cilt bakımı
      { serviceId: facial.id, staffId: staff2.id },
      { serviceId: massage.id, staffId: staff2.id },

      // Zeynep - Tırnak bakımı
      { serviceId: manicure.id, staffId: staff3.id },
      { serviceId: pedicure.id, staffId: staff3.id },
      { serviceId: gelNails.id, staffId: staff3.id },
    ]);

    console.log('✓ Service-Staff assignments created');

    // 9. Assign Services to Locations
    console.log('Assigning services to locations...');

    await db.insert(schema.serviceLocations).values([
      // Merkez Şube - Tüm hizmetler
      { serviceId: haircut.id, locationId: location1.id },
      { serviceId: hairColor.id, locationId: location1.id },
      { serviceId: hairTreatment.id, locationId: location1.id },
      { serviceId: facial.id, locationId: location1.id },
      { serviceId: massage.id, locationId: location1.id },
      { serviceId: manicure.id, locationId: location1.id },
      { serviceId: pedicure.id, locationId: location1.id },
      { serviceId: gelNails.id, locationId: location1.id },

      // Nişantaşı Şube - Sadece tırnak bakımı
      { serviceId: manicure.id, locationId: location2.id },
      { serviceId: pedicure.id, locationId: location2.id },
      { serviceId: gelNails.id, locationId: location2.id },
    ]);

    console.log('✓ Service-Location assignments created');

    // 10. Create Staff Working Hours
    console.log('Creating staff working hours...');

    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const weekend = ['saturday', 'sunday'];

    // Ayşe - Weekdays 09:00-18:00
    for (const day of weekdays) {
      await db.insert(schema.staffWorkingHours).values({
        staffId: staff1.id,
        dayOfWeek: day as any,
        startTime: '09:00:00',
        endTime: '18:00:00',
        isActive: true,
      });
    }

    // Mehmet - All week 10:00-19:00
    for (const day of [...weekdays, ...weekend]) {
      await db.insert(schema.staffWorkingHours).values({
        staffId: staff2.id,
        dayOfWeek: day as any,
        startTime: '10:00:00',
        endTime: '19:00:00',
        isActive: true,
      });
    }

    // Zeynep - Weekdays 11:00-20:00, Weekend 10:00-18:00
    for (const day of weekdays) {
      await db.insert(schema.staffWorkingHours).values({
        staffId: staff3.id,
        dayOfWeek: day as any,
        startTime: '11:00:00',
        endTime: '20:00:00',
        isActive: true,
      });
    }
    for (const day of weekend) {
      await db.insert(schema.staffWorkingHours).values({
        staffId: staff3.id,
        dayOfWeek: day as any,
        startTime: '10:00:00',
        endTime: '18:00:00',
        isActive: true,
      });
    }

    console.log('✓ Staff working hours created');

    // 11. Create Widget Settings
    console.log('Creating widget settings...');

    const publicToken = 'demo-public-token';
    const allowedDomains = ['localhost'];

    const [widgetSettings] = await db
      .insert(schema.widgetSettings)
      .values({
        storeId: store.id,
        layout: 'list',
        showCompanyEmail: true,
        companyEmail: 'info@guzelliklsalonu.com',
        sidebarMenuItems: {
          service: true,
          employee: true,
          location: true,
          extras: true,
          dateTime: true,
          customerInfo: true,
          payment: false,
        },
        employeeRequired: false,
        locationRequired: false,
        lastNameRequired: true,
        emailRequired: true,
        phoneRequired: true,
        primaryColor: '#FF6B6B',
        secondaryColor: '#ffffff',
        sidebarBackgroundColor: '#F5F7FA',
        contentBackgroundColor: '#ffffff',
        textColor: '#333333',
        headingColor: '#1A1A1A',
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        buttonBorderRadius: 8,
        showProgressBar: true,
        allowGuestBooking: true,
        redirectUrlAfterBooking: null,
        widgetKey: 'demo-widget-key',
        publicToken,
        allowedDomains,
      })
      .returning();

    console.log('✓ Widget settings created');
    console.log('🔑 Widget Key:', widgetSettings.widgetKey);
    console.log('🔒 Public Token:', widgetSettings.publicToken);
    console.log('🌐 Allowed Domains:', allowedDomains.join(', '));

    // 12. Create Notification Settings
    console.log('Creating notification settings...');

    await db.insert(schema.notificationSettings).values({
      storeId: store.id,
      appointmentConfirmationEnabled: true,
      appointmentConfirmationChannel: 'email',
      appointmentReminderEnabled: true,
      appointmentReminderChannel: 'email',
      reminder24hEnabled: true,
      reminder1hEnabled: false,
      appointmentCancellationEnabled: true,
      appointmentCancellationChannel: 'email',
      appointmentRescheduledEnabled: true,
      appointmentRescheduledChannel: 'email',
      feedbackRequestSmsEnabled: false,
      staffInvitationEnabled: true,
      senderEmail: 'noreply@guzelliklsalonu.com',
      senderName: 'Güzellik Salonu',
      replyToEmail: 'info@guzelliklsalonu.com',
      emailProvider: 'smtp',
    });

    console.log('✓ Notification settings created');

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Summary:');
    console.log('   - 1 Admin User (admin@salontakvim.com / admin123)');
    console.log('   - 3 Staff Users');
    console.log('   - 1 Store (Güzellik Salonu)');
    console.log('   - 3 Categories');
    console.log('   - 2 Locations');
    console.log('   - 9 Services');
    console.log('   - 5 Service Extras');
    console.log('   - Widget Key: demo-widget-key');
    console.log('   - Public Token: demo-public-token');
    console.log('   - Allowed Domains: localhost');
    console.log('\n🚀 You can now test the widget at:');
    console.log('   http://localhost:5173?key=demo-widget-key');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed();
