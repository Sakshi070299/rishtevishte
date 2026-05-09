import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for seed');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
// Language server may lag behind `prisma generate`; cast to any for new models.
// tsc --noEmit confirms all fields are valid at compile time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

async function main() {
  console.log('Seeding database...');

  // ── Default Admin User (unified User table)
  await prisma.user.upsert({
    where: { mobile: '9999999999' },
    update: { role: Role.ADMIN, isSuperAdmin: true },
    create: {
      name: 'Super Admin',
      mobile: '9999999999',
      role: Role.ADMIN,
      isSuperAdmin: true,
    },
  });
  console.log('Admin user created (mobile: 9999999999)');

  // ── Default Site Settings
  const settings = [
    { key: 'weekly_profile_limit', value: '5', label: 'Weekly Profile View Limit' },
    { key: 'registration_fee_basic', value: '501', label: 'Basic Registration Fee (Rs.)' },
    { key: 'registration_fee_premium', value: '1100', label: 'Premium Registration Fee (Rs.)' },
    { key: 'temple_name', value: 'Mandir', label: 'Temple Name' },
    { key: 'temple_name_hi', value: 'मंदिर', label: 'Temple Name (Hindi)' },
    { key: 'temple_address', value: 'Mandir, Ram Lila Ground Chowk Geeta Colony, Jheel Khurenja, East Delhi - 110031', label: 'Temple Address' },
    { key: 'temple_phone', value: '+91 98102 77873, +91 98999 57029', label: 'Temple Phone' },
    { key: 'temple_email', value: 'hanumanmandirgeetacolony@gmail.com', label: 'Temple Email' },
    {
      key: 'terms_and_conditions',
      value: 'By registering on RishteNate, you agree to provide accurate personal information and use this platform solely for matrimonial purposes within the temple community. All data is handled in accordance with applicable laws. The temple management reserves the right to remove any profile that violates community standards.',
      label: 'Terms & Conditions',
    },
    {
      key: 'privacy_policy',
      value: 'RishteNate collects personal information solely for facilitating matrimonial matches within the Mandir community. Your data is never sold to third parties. Contact details are shared only with verified members. You may request deletion of your data at any time by contacting the temple office.',
      label: 'Privacy Policy',
    },
  ];

  for (const setting of settings) {
    await prisma.siteSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log('Default settings created');

  // ── Sample Team Member (unified User table with role=TEAM)
  await prisma.user.upsert({
    where: { mobile: '8888888888' },
    update: { role: Role.TEAM },
    create: {
      name: 'Ram Sewak',
      mobile: '8888888888',
      role: Role.TEAM,
    },
  });
  console.log('Sample team member created (mobile: 8888888888)');

  // ── Sample Manager (role=MANAGER)
  // Use db (any-cast) for MANAGER because the language server may resolve a
  // stale Role enum that pre-dates `prisma generate`. tsc --noEmit is clean.
  await db.user.upsert({
    where: { mobile: '7777777777' },
    update: { role: 'MANAGER' },
    create: {
      name: 'Suresh Kumar',
      mobile: '7777777777',
      role: 'MANAGER',
    },
  });
  console.log('Sample manager created (mobile: 7777777777)');

  // ── Sample Banners
  const banners = [
    {
      title: 'RishteNate Matrimony Fair 2026',
      titleHi: 'रिश्तेसेतु विवाह मेला 2026',
      imageUrl: 'https://placehold.co/1200x400?text=Matrimony+Fair+2026',
      linkUrl: null,
      sortOrder: 1,
    },
    {
      title: 'Register Your Profile Today',
      titleHi: 'आज ही अपना प्रोफ़ाइल पंजीकृत करें',
      imageUrl: 'https://placehold.co/1200x400?text=Register+Now',
      linkUrl: null,
      sortOrder: 2,
    },
    {
      title: 'Mandir',
      titleHi: 'मंदिर',
      imageUrl: 'https://placehold.co/1200x400?text=Hanuman+Mandir',
      linkUrl: null,
      sortOrder: 3,
    },
  ];

  for (const banner of banners) {
    const existing = await db.banner.findFirst({ where: { title: banner.title } });
    if (!existing) {
      await db.banner.create({ data: banner });
    }
  }
  console.log('Sample banners created (3 banners)');

  // ── Gallery Images
  const galleryImages = [
    {
      title: '51-ft Hanuman Ji Murti',
      titleHi: '51 फीट हनुमान जी की मूर्ति',
      imageUrl: 'https://itin-dev.wanderlogstatic.com/freeImage/g1Q1r8vLGfGiXn2WXAnPvyqhZVGkGWZn',
      sortOrder: 1,
    },
    {
      title: 'Temple Night View',
      titleHi: 'रात्रि दर्शन',
      imageUrl: 'https://itin-dev.wanderlogstatic.com/freeImage/cCS02pA4rZ0iWQ4i8ylTznDX5aa3kgbX',
      sortOrder: 2,
    },
    {
      title: 'Temple Premises',
      titleHi: 'मंदिर परिसर',
      imageUrl: 'https://itin-dev.wanderlogstatic.com/freeImage/wOt2iDt8OSaWmTvanRHlk2voBvY9YBI1',
      sortOrder: 3,
    },
    {
      title: 'Hanuman Jayanti',
      titleHi: 'हनुमान जयंती समारोह',
      imageUrl: 'https://images.pexels.com/photos/13579932/pexels-photo-13579932.jpeg?auto=compress&cs=tinysrgb&w=600&h=450&fit=crop',
      sortOrder: 4,
    },
    {
      title: 'Sandhya Aarti',
      titleHi: 'संध्या आरती',
      imageUrl: 'https://images.pexels.com/photos/34480920/pexels-photo-34480920.jpeg?auto=compress&cs=tinysrgb&w=600&h=450&fit=crop',
      sortOrder: 5,
    },
    {
      title: 'Ramleela Festival',
      titleHi: 'रामलीला उत्सव',
      imageUrl: 'https://images.pexels.com/photos/5178616/pexels-photo-5178616.jpeg?auto=compress&cs=tinysrgb&w=600&h=450&fit=crop',
      sortOrder: 6,
    },
    {
      title: 'Bhandara Prasad',
      titleHi: 'भंडारा प्रसाद',
      imageUrl: 'https://images.pexels.com/photos/7785979/pexels-photo-7785979.jpeg?auto=compress&cs=tinysrgb&w=600&h=450&fit=crop',
      sortOrder: 7,
    },
    {
      title: 'Temple Entrance',
      titleHi: 'मंदिर प्रवेश द्वार',
      imageUrl: 'https://images.pexels.com/photos/24771796/pexels-photo-24771796.jpeg?auto=compress&cs=tinysrgb&w=600&h=450&fit=crop',
      sortOrder: 8,
    },
  ];

  for (const img of galleryImages) {
    const existing = await db.galleryImage.findFirst({ where: { title: img.title } });
    if (!existing) {
      await db.galleryImage.create({ data: img });
    }
  }
  console.log('Gallery images seeded (8 images)');

  console.log('Seed complete! Jai Shri Ram!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
