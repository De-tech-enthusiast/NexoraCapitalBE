import { db } from '../config/database';
import { users, portfolios } from '../config/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Check if admin already exists
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.email, 'admin@nexora.com'),
    });

    if (existingAdmin) {
      console.log('✓ Admin user already exists, skipping seed');
      process.exit(0);
    }

    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('admin123', salt);

    const [admin] = await db.insert(users).values({
      email: 'admin@nexora.com',
      passwordHash: adminPasswordHash,
      username: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      country: 'United States',
      role: 'admin',
      verificationStatus: 'verified',
      emailVerified: true,
    }).returning();

    console.log('✓ Admin user created:');
    console.log('  Email: admin@nexora.com');
    console.log('  Password: admin123');
    console.log('');

    // Create demo user
    const demoPasswordHash = await bcrypt.hash('password', salt);

    const [demoUser] = await db.insert(users).values({
      email: 'eben@nexora.com',
      passwordHash: demoPasswordHash,
      username: 'eben',
      firstName: 'Eben',
      lastName: 'Anderson',
      country: 'United States',
      preferredCurrency: 'USD',
      role: 'user',
      verificationStatus: 'verified',
      emailVerified: true,
    }).returning();

    // Create demo portfolio with some initial data
    await db.insert(portfolios).values({
      userId: demoUser.id,
      currentValue: '46500.00',
      totalInvested: '42000.00',
      totalProfit: '4500.00',
      profitPercentage: '10.71',
    });

    console.log('✓ Demo user created:');
    console.log('  Email: eben@nexora.com');
    console.log('  Password: password');
    console.log('  Portfolio: $46,500 (started with $42,000)');
    console.log('');

    console.log('✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
