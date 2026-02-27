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
        country: 'TR',
        currency: 'TRY',
        paymentStatus: 'freemium',
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

    // Owner as staff (so they can take appointments too)
    const [ownerStaff] = await db
      .insert(schema.staffMembers)
      .values({
        userId: adminUser.id,
        storeId: store.id,
        locationId: location1.id,
        bio: 'İşletme sahibi ve baş stilist.',
        title: 'Salon Sahibi / Lead',
        isVisible: true,
      })
      .returning();

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
        locationId: location2.id,
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
        role: 'manager',
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

      // Nişantaşı Şube - Tırnak bakımı + Saç hizmetleri
      { serviceId: haircut.id, locationId: location2.id },
      { serviceId: hairColor.id, locationId: location2.id },
      { serviceId: hairTreatment.id, locationId: location2.id },
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
        allowedDomains,
      })
      .returning();

    console.log('✓ Widget settings created');
    console.log('🔑 Widget Key:', widgetSettings.widgetKey);
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

    // 13. Create Customer User
    console.log('Creating customer user...');
    const [customerUser] = await db
      .insert(schema.users)
      .values({
        email: 'fmc_canbolat@hotmail.com',
        firstName: 'Fatih',
        lastName: 'Canbolat',
        phone: '+90 532 123 4567',
        password: null,
        role: 'customer',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    console.log('✓ Customer user created:', customerUser.email);

    // Register customer to store
    await db.insert(schema.storeCustomers).values({
      storeId: store.id,
      customerId: customerUser.id,
      publicNumber: '001',
      publicNumberCounter: 1,
    });

    console.log('✓ Store customer registered');

    // 14. Create Appointments
    console.log('Creating appointments...');

    const now = new Date();

    // Helper to create dates relative to now
    const daysAgo = (days: number, hour: number = 10, minute: number = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      d.setHours(hour, minute, 0, 0);
      return d;
    };

    const daysFromNow = (
      days: number,
      hour: number = 10,
      minute: number = 0,
    ) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      d.setHours(hour, minute, 0, 0);
      return d;
    };

    const addMinutes = (date: Date, minutes: number) => {
      return new Date(date.getTime() + minutes * 60000);
    };

    // Appointment 1: Completed haircut with Ayşe, 14 days ago
    const apt1Start = daysAgo(14, 10, 0);
    const [appointment1] = (await db
      .insert(schema.appointments)
      .values({
        publicNumber: '001',
        publicNumberCounter: 1,
        storeId: store.id,
        customerId: customerUser.id,
        serviceId: haircut.id,
        staffId: staff1.id,
        locationId: location2.id,
        startDateTime: apt1Start,
        endDateTime: addMinutes(apt1Start, 45),
        status: 'completed',
        totalPrice: '250.00',
        paymentMethod: 'cash',
        isPaid: true,
        paidAt: addMinutes(apt1Start, 45),
        customerNotes: 'Kısa kesim istiyorum',
        feedbackSentAt: daysAgo(13, 9, 0),
      })
      .returning()) as any[];

    // Appointment 2: Completed facial with Mehmet, 7 days ago
    const apt2Start = daysAgo(7, 14, 0);
    const [appointment2] = (await db
      .insert(schema.appointments)
      .values({
        publicNumber: '002',
        publicNumberCounter: 2,
        storeId: store.id,
        customerId: customerUser.id,
        serviceId: facial.id,
        staffId: staff2.id,
        locationId: location1.id,
        startDateTime: apt2Start,
        endDateTime: addMinutes(apt2Start, 60),
        status: 'completed',
        totalPrice: '750.00',
        paymentMethod: 'card',
        isPaid: true,
        paidAt: addMinutes(apt2Start, 60),
        customerNotes: 'Hassas cildim var, dikkatli olunması rica ederim',
        feedbackSentAt: daysAgo(6, 10, 0),
      })
      .returning()) as any[];

    // Appointment 3: Completed manicure with Zeynep, 3 days ago
    const apt3Start = daysAgo(3, 11, 30);
    const [appointment3] = (await db
      .insert(schema.appointments)
      .values({
        publicNumber: '003',
        publicNumberCounter: 3,
        storeId: store.id,
        customerId: customerUser.id,
        serviceId: manicure.id,
        staffId: staff3.id,
        locationId: location2.id,
        startDateTime: apt3Start,
        endDateTime: addMinutes(apt3Start, 45),
        status: 'completed',
        totalPrice: '200.00',
        paymentMethod: 'cash',
        isPaid: true,
        paidAt: addMinutes(apt3Start, 45),
        feedbackSentAt: daysAgo(2, 12, 0),
      })
      .returning()) as any[];

    // Appointment 4: Cancelled haircut, was supposed to be 5 days ago
    const apt4Start = daysAgo(5, 15, 0);
    const [appointment4] = (await db
      .insert(schema.appointments)
      .values({
        publicNumber: '004',
        publicNumberCounter: 4,
        storeId: store.id,
        customerId: customerUser.id,
        serviceId: haircut.id,
        staffId: staff1.id,
        locationId: location2.id,
        startDateTime: apt4Start,
        endDateTime: addMinutes(apt4Start, 45),
        status: 'cancelled',
        totalPrice: '250.00',
        isPaid: false,
        cancelledAt: daysAgo(7, 18, 30),
        cancellationReason:
          'Acil bir işim çıktı, iptal etmek zorundayım. Başka bir zamana erteleyebilir miyiz?',
        customerNotes: 'Saç boyama da yaptırmak istiyordum',
      })
      .returning()) as any[];

    // Appointment 5: Cancelled massage, was supposed to be 3 days ago
    const apt5Start = daysAgo(3, 16, 0);
    const [appointment5] = (await db
      .insert(schema.appointments)
      .values({
        publicNumber: '005',
        publicNumberCounter: 5,
        storeId: store.id,
        customerId: customerUser.id,
        serviceId: massage.id,
        staffId: staff2.id,
        locationId: location1.id,
        startDateTime: apt5Start,
        endDateTime: addMinutes(apt5Start, 75),
        status: 'cancelled',
        totalPrice: '550.00',
        isPaid: false,
        cancelledAt: daysAgo(4, 10, 0),
        cancellationReason:
          'Sağlık sorunları nedeniyle gelemiyorum, en kısa sürede yeni randevu alacağım.',
      })
      .returning()) as any[];

    // Appointment 6: Confirmed appointment, 3 days from now
    const apt6Start = daysFromNow(3, 10, 0);
    const [appointment6] = (await db
      .insert(schema.appointments)
      .values({
        publicNumber: '006',
        publicNumberCounter: 6,
        storeId: store.id,
        customerId: customerUser.id,
        serviceId: hairColor.id,
        staffId: staff1.id,
        locationId: location2.id,
        startDateTime: apt6Start,
        endDateTime: addMinutes(apt6Start, 120),
        status: 'confirmed',
        totalPrice: '850.00',
        isPaid: false,
        customerNotes: 'Açık kahverengi tonlarda boyatmak istiyorum',
      })
      .returning()) as any[];

    // Appointment 7: Pending appointment, 10 days from now
    const apt7Start = daysFromNow(10, 14, 0);
    const [appointment7] = (await db
      .insert(schema.appointments)
      .values({
        publicNumber: '007',
        publicNumberCounter: 7,
        storeId: store.id,
        customerId: customerUser.id,
        serviceId: gelNails.id,
        staffId: staff3.id,
        locationId: location2.id,
        startDateTime: apt7Start,
        endDateTime: addMinutes(apt7Start, 50),
        status: 'pending',
        totalPrice: '300.00',
        isPaid: false,
        customerNotes: 'French manikür tarzında olsun lütfen',
      })
      .returning()) as any[];

    console.log(
      '✓ Appointments created: 7 (3 completed, 2 cancelled, 1 confirmed, 1 pending)',
    );

    // 15. Create Appointment Feedback
    console.log('Creating feedback...');

    await db.insert(schema.appointmentFeedback).values([
      {
        appointmentId: appointment1.id,
        storeId: store.id,
        customerId: customerUser.id,
        staffId: staff1.id,
        serviceId: haircut.id,
        overallRating: 5,
        serviceRating: 5,
        staffRating: 5,
        cleanlinessRating: 5,
        valueRating: 4,
        comment:
          'Harika bir deneyimdi! Ayşe Hanım çok profesyonel, saçlarım tam istediğim gibi oldu. Kesinlikle tekrar geleceğim.',
        isVerified: true,
      },
      {
        appointmentId: appointment2.id,
        storeId: store.id,
        customerId: customerUser.id,
        staffId: staff2.id,
        serviceId: facial.id,
        overallRating: 4,
        serviceRating: 4,
        staffRating: 5,
        cleanlinessRating: 4,
        valueRating: 3,
        comment:
          'Cilt bakımı gayet iyiydi, Mehmet Bey çok ilgili. Fiyat biraz yüksek ama kalite iyi.',
        isVerified: true,
      },
      {
        appointmentId: appointment3.id,
        storeId: store.id,
        customerId: customerUser.id,
        staffId: staff3.id,
        serviceId: manicure.id,
        overallRating: 3,
        serviceRating: 3,
        staffRating: 4,
        cleanlinessRating: 3,
        valueRating: 3,
        comment:
          'Manikür fena değildi ama beklediğim kadar uzun sürmedi. Zeynep Hanım ilgiliydi fakat salon biraz kalabalıktı.',
        isVerified: true,
      },
    ]);

    console.log('✓ Feedback created: 3');

    // 16. Create Notifications
    console.log('Creating notifications...');

    await db.insert(schema.notifications).values([
      // Appointment confirmation notifications (read - past)
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Randevu Onaylandı',
        message: `Saç Kesimi randevunuz ${apt1Start.toLocaleDateString('tr-TR')} tarihinde onaylanmıştır.`,
        type: 'appointment_confirmation',
        metadata: { appointmentId: appointment1.id },
        isRead: true,
      },
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Randevu Onaylandı',
        message: `Cilt Bakımı (Hydrafacial) randevunuz ${apt2Start.toLocaleDateString('tr-TR')} tarihinde onaylanmıştır.`,
        type: 'appointment_confirmation',
        metadata: { appointmentId: appointment2.id },
        isRead: true,
      },
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Randevu Onaylandı',
        message: `Manikür randevunuz ${apt3Start.toLocaleDateString('tr-TR')} tarihinde onaylanmıştır.`,
        type: 'appointment_confirmation',
        metadata: { appointmentId: appointment3.id },
        isRead: true,
      },
      // Cancellation notifications
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Randevu İptal Edildi',
        message: `${apt4Start.toLocaleDateString('tr-TR')} tarihli Saç Kesimi randevunuz iptal edilmiştir. Sebep: Acil bir işim çıktı.`,
        type: 'appointment_cancelled',
        metadata: { appointmentId: appointment4.id },
        isRead: true,
      },
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Randevu İptal Edildi',
        message: `${apt5Start.toLocaleDateString('tr-TR')} tarihli Rahatlatıcı Masaj randevunuz iptal edilmiştir. Sebep: Sağlık sorunları.`,
        type: 'appointment_cancelled',
        metadata: { appointmentId: appointment5.id },
        isRead: true,
      },
      // Feedback request notifications
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Deneyiminizi Paylaşın',
        message:
          'Saç Kesimi hizmetimizi değerlendirmek ister misiniz? Geri bildiriminiz bizim için çok değerli!',
        type: 'appointment_feedback',
        metadata: { appointmentId: appointment1.id },
        isRead: true,
      },
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Deneyiminizi Paylaşın',
        message:
          'Cilt Bakımı (Hydrafacial) hizmetimizi değerlendirmek ister misiniz? Geri bildiriminiz bizim için çok değerli!',
        type: 'appointment_feedback',
        metadata: { appointmentId: appointment2.id },
        isRead: true,
      },
      // Upcoming appointment confirmations + reminder (unread)
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Randevu Onaylandı',
        message: `Saç Boyama randevunuz ${apt6Start.toLocaleDateString('tr-TR')} tarihinde onaylanmıştır. Ayşe Demir sizi bekliyor!`,
        type: 'appointment_confirmation',
        metadata: { appointmentId: appointment6.id },
        isRead: false,
      },
      {
        userId: customerUser.id,
        storeId: store.id,
        title: 'Randevu Hatırlatması',
        message: `Saç Boyama randevunuz ${apt6Start.toLocaleDateString('tr-TR')} tarihinde saat ${apt6Start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}'de. Unutmayın!`,
        type: 'appointment_reminder',
        metadata: { appointmentId: appointment6.id },
        isRead: false,
      },
      // Staff/Admin notifications
      {
        userId: adminUser.id,
        storeId: store.id,
        title: 'Yeni Randevu',
        message: `Fatih Canbolat ${apt6Start.toLocaleDateString('tr-TR')} tarihinde Saç Boyama için randevu aldı.`,
        type: 'new_appointment',
        metadata: {
          appointmentId: appointment6.id,
          customerId: customerUser.id,
        },
        isRead: false,
      },
      {
        userId: adminUser.id,
        storeId: store.id,
        title: 'Yeni Randevu',
        message: `Fatih Canbolat ${apt7Start.toLocaleDateString('tr-TR')} tarihinde Kalıcı Oje (Gel) için randevu aldı.`,
        type: 'new_appointment',
        metadata: {
          appointmentId: appointment7.id,
          customerId: customerUser.id,
        },
        isRead: false,
      },
    ]);

    console.log('✓ Notifications created: 11');

    // 17. Create Activity Records
    console.log('Creating activity records...');

    await db.insert(schema.activities).values([
      {
        storeId: store.id,
        type: 'staff' as const,
        message: 'Zeynep Şahin yönetici olarak atandı (Nişantaşı Şube)',
        metadata: {
          userId: staff3User.id,
          role: 'manager',
          locationId: location2.id,
        },
        createdAt: daysAgo(20),
      },
      {
        storeId: store.id,
        type: 'staff' as const,
        message: "Ayşe Demir Nişantaşı Şube'ye transfer edildi",
        metadata: { userId: staff1User.id, locationId: location2.id },
        createdAt: daysAgo(18),
      },
      {
        storeId: store.id,
        type: 'customer' as const,
        message:
          'Yeni müşteri kaydı: Fatih Canbolat (fmc_canbolat@hotmail.com)',
        metadata: {
          userId: customerUser.id,
          email: 'fmc_canbolat@hotmail.com',
        },
        createdAt: daysAgo(15),
      },
      {
        storeId: store.id,
        type: 'appointment' as const,
        message: 'Randevu tamamlandı: Fatih Canbolat - Saç Kesimi',
        metadata: { appointmentId: appointment1.id, status: 'completed' },
        createdAt: daysAgo(14, 10, 45),
      },
      {
        storeId: store.id,
        type: 'appointment' as const,
        message:
          'Randevu iptal edildi: Fatih Canbolat - Saç Kesimi. Sebep: Acil bir işim çıktı.',
        metadata: {
          appointmentId: appointment4.id,
          status: 'cancelled',
          reason: 'Acil bir işim çıktı',
        },
        createdAt: daysAgo(7, 18, 30),
      },
      {
        storeId: store.id,
        type: 'appointment' as const,
        message: 'Randevu tamamlandı: Fatih Canbolat - Cilt Bakımı',
        metadata: { appointmentId: appointment2.id, status: 'completed' },
        createdAt: daysAgo(7, 15, 0),
      },
      {
        storeId: store.id,
        type: 'appointment' as const,
        message:
          'Randevu iptal edildi: Fatih Canbolat - Rahatlatıcı Masaj. Sebep: Sağlık sorunları.',
        metadata: {
          appointmentId: appointment5.id,
          status: 'cancelled',
          reason: 'Sağlık sorunları',
        },
        createdAt: daysAgo(4, 10, 0),
      },
      {
        storeId: store.id,
        type: 'appointment' as const,
        message: 'Randevu tamamlandı: Fatih Canbolat - Manikür',
        metadata: { appointmentId: appointment3.id, status: 'completed' },
        createdAt: daysAgo(3, 12, 15),
      },
    ]);

    console.log('✓ Activity records created: 8');

    // 18. Create UK Stripe-ready dental clinic demo store
    console.log('Creating UK Stripe-ready dental clinic demo store...');

    const [ukAdminUser] = await db
      .insert(schema.users)
      .values({
        email: 'admin.uk@salontakvim.com',
        firstName: 'Oliver',
        lastName: 'Brown',
        phone: '+44 7700 900123',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    const [ukStore] = await db
      .insert(schema.stores)
      .values({
        ownerId: ukAdminUser.id,
        name: 'London Dental Clinic',
        slug: 'london-dental-clinic',
        description:
          'UK dental clinic demo store with Stripe billing and Connect enabled',
        email: 'hello@londondentalclinic.co.uk',
        phone: '+44 20 7946 1200',
        country: 'GB',
        currency: 'GBP',
        paymentStatus: 'freemium',
        stripeConnectOnboarded: false,
        isActive: true,
      })
      .returning();

    const [ukLocation1] = await db
      .insert(schema.locations)
      .values({
        storeId: ukStore.id,
        name: 'Marylebone Branch',
        address: '22 Harley Street, Marylebone',
        city: 'London',
        state: 'England',
        zipCode: 'W1G 9PL',
        country: 'United Kingdom',
        phone: '+44 20 7946 1200',
        email: 'marylebone@londondentalclinic.co.uk',
        isVisible: true,
      })
      .returning();

    const [ukLocation2] = await db
      .insert(schema.locations)
      .values({
        storeId: ukStore.id,
        name: 'Chelsea Branch',
        address: "15 King's Road, Chelsea",
        city: 'London',
        state: 'England',
        zipCode: 'SW3 4TR',
        country: 'United Kingdom',
        phone: '+44 20 7946 1300',
        email: 'chelsea@londondentalclinic.co.uk',
        isVisible: true,
      })
      .returning();

    const [ukGeneralCategory] = await db
      .insert(schema.categories)
      .values({
        storeId: ukStore.id,
        name: 'General Dentistry',
        description: 'Routine dental care and hygiene services',
        color: '#4F46E5',
        icon: 'Tooth',
        position: 0,
        isVisible: true,
      })
      .returning();

    const [ukCosmeticCategory] = await db
      .insert(schema.categories)
      .values({
        storeId: ukStore.id,
        name: 'Cosmetic Dentistry',
        description: 'Transform your smile with our aesthetic treatments',
        color: '#EC4899',
        icon: 'Sparkles',
        position: 1,
        isVisible: true,
      })
      .returning();

    const [ukOrthodonticCategory] = await db
      .insert(schema.categories)
      .values({
        storeId: ukStore.id,
        name: 'Orthodontics',
        description: 'Straighten your teeth with modern solutions',
        color: '#10B981',
        icon: 'Shield-check',
        position: 2,
        isVisible: true,
      })
      .returning();

    const [ukCheckupService] = await db
      .insert(schema.services)
      .values({
        storeId: ukStore.id,
        categoryId: ukGeneralCategory.id,
        name: 'Dental Check-up & Cleaning',
        description:
          'Comprehensive dental examination with professional cleaning',
        duration: 45,
        price: '95.00',
        capacity: 1,
        bufferTimeBefore: 10,
        bufferTimeAfter: 10,
        isVisible: true,
        showBringingAnyoneOption: false,
        allowRecurring: true,
        position: 0,
      })
      .returning();

    const [ukEmergencyService] = await db
      .insert(schema.services)
      .values({
        storeId: ukStore.id,
        categoryId: ukGeneralCategory.id,
        name: 'Emergency Appointment',
        description: 'Immediate care for dental pain or injury',
        duration: 30,
        price: '120.00',
        capacity: 1,
        bufferTimeBefore: 0,
        bufferTimeAfter: 15,
        isVisible: true,
        showBringingAnyoneOption: false,
        allowRecurring: false,
        position: 1,
      })
      .returning();

    const [ukWhiteningService] = await db
      .insert(schema.services)
      .values({
        storeId: ukStore.id,
        categoryId: ukCosmeticCategory.id,
        name: 'Professional Teeth Whitening',
        description: 'Bring back the brightness of your smile',
        duration: 60,
        price: '250.00',
        capacity: 1,
        bufferTimeBefore: 5,
        bufferTimeAfter: 5,
        isVisible: true,
        showBringingAnyoneOption: false,
        allowRecurring: false,
        position: 0,
      })
      .returning();

    const [ukInvisalignService] = await db
      .insert(schema.services)
      .values({
        storeId: ukStore.id,
        categoryId: ukOrthodonticCategory.id,
        name: 'Invisalign Consultation',
        description: 'Find out if clear aligners are right for you',
        duration: 30,
        price: '50.00',
        capacity: 1,
        bufferTimeBefore: 10,
        bufferTimeAfter: 5,
        isVisible: true,
        showBringingAnyoneOption: false,
        allowRecurring: false,
        position: 0,
      })
      .returning();

    // Staff creation
    const [ukStaff1User] = await db
      .insert(schema.users)
      .values({
        email: 'dr.smith@londondentalclinic.co.uk',
        firstName: 'Emma',
        lastName: 'Smith',
        phone: '+44 7700 900456',
        password: await bcrypt.hash('staff123', 10),
        role: 'staff',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    const [ukStaff1] = await db
      .insert(schema.staffMembers)
      .values({
        userId: ukStaff1User.id,
        storeId: ukStore.id,
        locationId: ukLocation1.id,
        bio: 'General dentist focused on preventive care and oral hygiene.',
        title: 'General Dentist',
        isVisible: true,
      })
      .returning();

    const [ukStaff2User] = await db
      .insert(schema.users)
      .values({
        email: 'dr.wilson@londondentalclinic.co.uk',
        firstName: 'James',
        lastName: 'Wilson',
        phone: '+44 7700 900789',
        password: await bcrypt.hash('staff123', 10),
        role: 'staff',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    const [ukStaff2] = await db
      .insert(schema.staffMembers)
      .values({
        userId: ukStaff2User.id,
        storeId: ukStore.id,
        locationId: ukLocation2.id,
        bio: 'Specialist orthodontist with 15 years experience in smile transformations.',
        title: 'Specialist Orthodontist',
        isVisible: true,
      })
      .returning();

    const [ukManagerUser] = await db
      .insert(schema.users)
      .values({
        email: 'sarah.manager@londondentalclinic.co.uk',
        firstName: 'Sarah',
        lastName: 'Jenkins',
        phone: '+44 7700 900999',
        password: await bcrypt.hash('staff123', 10),
        role: 'manager',
        authProvider: 'local',
        isActive: true,
        emailVerified: true,
      })
      .returning();

    const [ukManager] = await db
      .insert(schema.staffMembers)
      .values({
        userId: ukManagerUser.id,
        storeId: ukStore.id,
        locationId: ukLocation1.id,
        bio: 'Clinic manager ensuring the highest standards of patient care.',
        title: 'Clinic Manager',
        isVisible: true,
      })
      .returning();

    // Assign Services to Staff & Locations
    await db.insert(schema.serviceStaff).values([
      { serviceId: ukCheckupService.id, staffId: ukStaff1.id },
      { serviceId: ukEmergencyService.id, staffId: ukStaff1.id },
      { serviceId: ukWhiteningService.id, staffId: ukStaff1.id },
      { serviceId: ukInvisalignService.id, staffId: ukStaff2.id },
    ]);

    await db.insert(schema.serviceLocations).values([
      { serviceId: ukCheckupService.id, locationId: ukLocation1.id },
      { serviceId: ukEmergencyService.id, locationId: ukLocation1.id },
      { serviceId: ukWhiteningService.id, locationId: ukLocation1.id },
      { serviceId: ukInvisalignService.id, locationId: ukLocation2.id },
      { serviceId: ukCheckupService.id, locationId: ukLocation2.id },
    ]);

    // Working Hours for all staff
    const ukStaffList = [ukStaff1.id, ukStaff2.id, ukManager.id];
    for (const staffId of ukStaffList) {
      for (const day of [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
      ]) {
        await db.insert(schema.staffWorkingHours).values({
          staffId,
          dayOfWeek: day as any,
          startTime: '09:00:00',
          endTime: '17:30:00',
          isActive: true,
        });
      }
    }

    const [ukWidgetSettings] = await db
      .insert(schema.widgetSettings)
      .values({
        storeId: ukStore.id,
        layout: 'list',
        showCompanyEmail: true,
        companyEmail: 'hello@londondentalclinic.co.uk',
        sidebarMenuItems: {
          service: true,
          employee: true,
          location: true,
          extras: true,
          dateTime: true,
          customerInfo: true,
          payment: true,
        },
        primaryColor: '#4F46E5',
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
        widgetKey: 'demo-widget-key-uk',
        allowedDomains: ['localhost'],
      })
      .returning();

    await db.insert(schema.notificationSettings).values({
      storeId: ukStore.id,
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
      senderEmail: 'noreply@londondentalclinic.co.uk',
      senderName: 'London Dental Clinic',
      replyToEmail: 'hello@londondentalclinic.co.uk',
      emailProvider: 'smtp',
    });

    console.log('✓ UK Notification settings created');

    // 19. Create UK appointments
    console.log('Creating UK appointments...');

    const ukApt1Start = daysAgo(2, 10, 0); // Past, completed
    await db.insert(schema.appointments).values({
      publicNumber: '001',
      publicNumberCounter: 1,
      storeId: ukStore.id,
      customerId: customerUser.id,
      serviceId: ukCheckupService.id,
      staffId: ukStaff1.id,
      locationId: ukLocation1.id,
      startDateTime: ukApt1Start,
      endDateTime: addMinutes(ukApt1Start, 45),
      status: 'completed',
      totalPrice: '95.00',
      paymentMethod: 'card',
      isPaid: true,
      paidAt: addMinutes(ukApt1Start, 45),
      customerNotes: 'First time visiting!',
    });

    const ukApt2Start = daysFromNow(2, 14, 0); // Future, confirmed
    await db.insert(schema.appointments).values({
      publicNumber: '002',
      publicNumberCounter: 2,
      storeId: ukStore.id,
      customerId: customerUser.id,
      serviceId: ukWhiteningService.id,
      staffId: ukStaff1.id,
      locationId: ukLocation1.id,
      startDateTime: ukApt2Start,
      endDateTime: addMinutes(ukApt2Start, 60),
      status: 'confirmed',
      totalPrice: '250.00',
      isPaid: false,
      customerNotes: 'Wants extra whitening gel',
    });

    const ukApt3Start = daysFromNow(5, 11, 0); // Future, pending
    await db.insert(schema.appointments).values({
      publicNumber: '003',
      publicNumberCounter: 3,
      storeId: ukStore.id,
      customerId: customerUser.id,
      serviceId: ukInvisalignService.id,
      staffId: ukStaff2.id,
      locationId: ukLocation2.id,
      startDateTime: ukApt3Start,
      endDateTime: addMinutes(ukApt3Start, 30),
      status: 'pending',
      totalPrice: '50.00',
      isPaid: false,
    });

    console.log(
      '✓ UK Appointments created: 3 (1 completed, 1 confirmed, 1 pending)',
    );

    // Register customer to UK store
    await db.insert(schema.storeCustomers).values({
      storeId: ukStore.id,
      customerId: customerUser.id,
      publicNumber: '001',
      publicNumberCounter: 1,
    });
    console.log('✓ Customer registered to UK store');

    console.log('✓ UK Stripe-ready dental clinic store created:', ukStore.name);
    console.log('🔑 UK Widget Key:', ukWidgetSettings.widgetKey);

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Summary:');
    console.log('   - 2 Admin Users (TR + UK demo owners, password: admin123)');
    console.log('   - 6 Staff Users (3 TR + 3 UK)');
    console.log('   - 1 Customer (fmc_canbolat@hotmail.com - Fatih Canbolat)');
    console.log('   - 2 Stores (Güzellik Salonu + London Dental Clinic)');
    console.log('   - 6 Categories (3 TR + 3 UK)');
    console.log('   - 4 Locations (2 TR + 2 UK)');
    console.log('   - 12 Services (8 TR + 4 UK)');
    console.log('   - 5 Service Extras (TR only)');
    console.log(
      '   - 10 Appointments (4 completed, 2 cancelled, 2 confirmed, 2 pending)',
    );
    console.log('   - 3 Feedback Records');
    console.log('   - 11 Notifications');
    console.log('   - 13 Activity Records');
    console.log('   - Widget Keys: demo-widget-key, demo-widget-key-uk');
    console.log('   - Allowed Domains: localhost');
    console.log('\n🚀 You can now test the widget at:');
    console.log('   http://localhost:5173?key=demo-widget-key');
    console.log('   http://localhost:5173?key=demo-widget-key-uk');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed();
