const projects = [
    { name: 'Website Redesign', client: 'TechCorp', status: 'In Progress', completion: 75 },
    { name: 'SEO Campaign', client: 'GreenEnergy', status: 'Planning', completion: 10 },
    { name: 'Social Media Strategy', client: 'FashionBrand', status: 'Completed', completion: 100 },
    { name: 'E-commerce Platform', client: 'LocalShop', status: 'In Progress', completion: 60 },
  ];

  const customers = [
    { name: 'Alice Johnson', email: 'alice@example.com', totalSpent: 5000, status: 'Active' },
    { name: 'Bob Smith', email: 'bob@example.com', totalSpent: 3500, status: 'Inactive' },
    { name: 'Charlie Brown', email: 'charlie@example.com', totalSpent: 7500, status: 'Active' },
    { name: 'Diana Ross', email: 'diana@example.com', totalSpent: 6000, status: 'Active' },
    { name: 'Edward Norton', email: 'edward@example.com', totalSpent: 4500, status: 'Inactive' },
  ];

  const revenueData = [
    { name: 'Jan', total: 15000 },
    { name: 'Feb', total: 20000 },
    { name: 'Mar', total: 18000 },
    { name: 'Apr', total: 25000 },
    { name: 'May', total: 30000 },
    { name: 'Jun', total: 28000 },
  ];

  const features = [
    { name: 'Responsive Design', description: 'Your website will look great on any device.' },
    { name: 'Customizable', description: 'You can customize your website to your liking.' },
    { name: 'SEO Friendly', description: 'Your website will be SEO friendly.' },
    { name: 'Analytics', description: 'You can track your website traffic.' },
    { name: 'Security', description: 'Your website will be secure.' },
    { name: 'Support', description: 'You will have access to our support team.' },
    { name: 'Maintenance', description: 'We will maintain your website for you.' },
    { name: 'Updates', description: 'We will keep your website updated with the latest features.' },
    { name: 'Backup', description: 'We will backup your website data.' },
    { name: 'Performance', description: 'Your website will be performant.' },
    { name: 'Scalability', description: 'Your website will be scalable.' },
    { name: 'Custom Domain', description: 'You can use your own domain.' },
    { name: 'SSL Certificate', description: 'Your website will be secure with an SSL certificate.' },
    { name: 'CDN', description: 'Your website will be served with a CDN.' },
    { name: 'Firewall', description: 'Your website will be protected with a firewall.' },
    { name: 'Dedicated Hosting', description: 'Your website will be hosted on a dedicated server.' },
    { name: 'Cloud Hosting', description: 'Your website will be hosted on the cloud.' },
    { name: 'Shared Hosting', description: 'Your website will be hosted on a shared server.' },
    { name: 'Payment Gateways', description: 'Integration with payment processing systems like Stripe, PayPal, or Square.', category: 'complex', multiplier: 1.5 },
    { name: 'Booking System', description: 'Online appointment scheduling and booking functionality.', category: 'standard', multiplier: 1.0 },
    { name: 'E-Commerce', description: 'Full online store with product catalog, shopping cart, and checkout process.', category: 'complex', multiplier: 1.8 },
    { name: 'Backend Development', description: 'Custom server-side logic, APIs, and database design.', category: 'complex', multiplier: 1.6 },
    { name: 'Backend Integration', description: 'Integration with existing backend systems and third-party APIs.', category: 'complex', multiplier: 1.4 },
  ];

  const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

export { projects, customers, revenueData, features, REFRESH_INTERVAL };
