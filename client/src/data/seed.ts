import type { 
  User, 
  Agency, 
  Course, 
  Quiz, 
  Order, 
  IntegrationConfig, 
  PaymentConfig,
  Announcement,
  SubscriptionPreferences
} from '../types';

export const SEED_USERS: User[] = [
  {
    id: 'admin-1',
    name: 'System Admin',
    email: 'admin@findandstudy.com',
    role: 'admin',
    password: 'admin123'
  },
  {
    id: 'agent-1',
    name: 'John Smith',
    email: 'john@agency.com',
    role: 'agent',
    agencyId: 'agency-1',
    password: 'agent123'
  }
];

export const SEED_AGENCIES: Agency[] = [
  {
    id: 'agency-1',
    name: 'Global Education Partners',
    address: 'Istanbul, Turkey',
    staffSize: 25,
    annualStudents: 500,
    website: 'https://globaledu.com',
    phone: '+90 212 555 0123',
    primaryContactName: 'John Smith',
    primaryContactEmail: 'john@agency.com'
  }
];

export const TURKEY_LESSON_HTML = `
<div class="lesson-content">
  <h2>Five Quick Points About Turkey</h2>
  <ul>
    <li>Turkey bridges Europe and Asia, offering a unique blend of cultures and opportunities</li>
    <li>Home to over 200 universities with growing international recognition</li>
    <li>Cost of living is significantly lower than Western Europe while maintaining quality</li>
    <li>Rich cultural heritage spanning ancient civilizations and modern innovations</li>
    <li>Gateway to both European and Middle Eastern opportunities</li>
  </ul>

  <h2>Location & Geography</h2>
  <p>Turkey is strategically located at the crossroads of Europe and Asia, with 97% of its territory in Asia Minor (Anatolia) and 3% in southeastern Europe. The country is bordered by eight nations and surrounded by four seas: the Black Sea, Mediterranean Sea, Aegean Sea, and Sea of Marmara.</p>

  <h2>Climate</h2>
  <p>Turkey has a diverse climate ranging from Mediterranean along the coasts to continental in the interior. Coastal areas enjoy mild winters and warm summers, while central Anatolia experiences more extreme temperature variations. The climate supports year-round outdoor activities and agricultural diversity.</p>

  <h2>History & Population</h2>
  <p>Turkey has a population of approximately 84 million people, with Istanbul being the largest city (15 million residents). The country has been home to numerous civilizations including the Byzantine Empire and Ottoman Empire, creating a rich historical tapestry that influences modern Turkish society.</p>

  <h2>Society & Culture</h2>
  <p>Turkish society blends traditional values with modern perspectives. The majority of the population is Muslim, but Turkey maintains a secular government. Turkish hospitality is legendary, and family plays a central role in society. The country has made significant strides in women's rights and education.</p>

  <h2>Economy</h2>
  <p>Turkey has a mixed economy with strong industrial, agricultural, and service sectors. The country is a member of the G20 and has experienced significant economic growth. Key industries include textiles, automotive, construction, and tourism. The Turkish Lira (TRY) is the national currency.</p>

  <h2>Government</h2>
  <p>Turkey is a presidential republic with a multi-party system. The President serves as both head of state and government. The Grand National Assembly is the legislative body. Turkey is a NATO member and candidate for EU membership.</p>

  <h2>Living Conditions & Cost of Living</h2>
  <p>Living costs in Turkey are generally 40-60% lower than Western European countries. Student accommodation ranges from $200-600 per month. Food, transportation, and entertainment are affordable. Healthcare is accessible through both public and private systems.</p>

  <h2>Education System (Higher Education in Türkiye)</h2>
  <p>Turkey's higher education system includes over 200 universities, both public and private. The academic year typically runs from September to June. Turkish universities offer programs in Turkish and increasingly in English. The country has invested heavily in education infrastructure and research facilities.</p>

  <h2>Information for International Students</h2>
  <p><strong>Residence Permit:</strong> International students must apply for a student residence permit within 30 days of arrival. Required documents include passport, student certificate, health insurance, and proof of financial means.</p>
  
  <p><strong>Health Insurance:</strong> All students must have health insurance. EU students can use their European Health Insurance Card (EHIC). Non-EU students should obtain Turkish health insurance or comprehensive international coverage.</p>
  
  <p><strong>Part-time Work:</strong> International students can work part-time (maximum 24 hours per week) with proper work permits. Summer work without restrictions is allowed. Many universities offer campus employment opportunities.</p>

  <h2>More Information (Official Links)</h2>
  <ul class="official-links">
    <li><a href="https://www.yok.gov.tr/" target="_blank">Council of Higher Education (YÖK)</a></li>
    <li><a href="https://www.evisa.gov.tr/" target="_blank">e-Visa</a></li>
    <li><a href="https://en.goc.gov.tr/" target="_blank">Presidency of Migration Management</a></li>
    <li><a href="https://www.turkiyeburslari.gov.tr/" target="_blank">Türkiye Scholarships</a></li>
    <li><a href="https://studyinturkiye.gov.tr/" target="_blank">Study in Türkiye portal</a></li>
  </ul>
</div>
`;

export const SEED_COURSES: Course[] = [
  {
    id: 'course-1',
    title: 'Find And Study Agent Training',
    slug: 'agent-training',
    sections: [
      {
        id: 'section-a1',
        title: 'A1 Destination Countries',
        lessons: [
          {
            id: 'lesson-turkey',
            title: 'Turkey',
            html: TURKEY_LESSON_HTML,
            quizId: 'quiz-turkey-mini'
          }
        ]
      }
    ]
  }
];

export const SEED_QUIZZES: Quiz[] = [
  {
    id: 'quiz-turkey-mini',
    title: 'Turkey Mini Quiz',
    passPercent: 70,
    questions: [
      {
        id: 'q1',
        type: 'boolean',
        text: 'Turkey is located at the crossroads of Europe and Asia.',
        answer: true
      },
      {
        id: 'q2',
        type: 'mcq',
        text: 'What percentage of Turkey is located in Asia Minor?',
        options: ['75%', '85%', '97%', '90%'],
        answerIndex: 2
      },
      {
        id: 'q3',
        type: 'boolean',
        text: 'International students in Turkey can work unlimited hours per week.',
        answer: false
      }
    ]
  },
  {
    id: 'quiz-final',
    title: 'Agent Training Final Exam',
    passPercent: 70,
    isFinal: true,
    questions: [
      {
        id: 'f1',
        type: 'mcq',
        text: 'What is the approximate population of Turkey?',
        options: ['74 million', '84 million', '94 million', '64 million'],
        answerIndex: 1
      },
      {
        id: 'f2',
        type: 'boolean',
        text: 'Turkey is a member of NATO.',
        answer: true
      },
      {
        id: 'f3',
        type: 'mcq',
        text: 'Which seas surround Turkey?',
        options: ['2 seas', '3 seas', '4 seas', '5 seas'],
        answerIndex: 2
      },
      {
        id: 'f4',
        type: 'boolean',
        text: 'Students need to apply for residence permits within 60 days of arrival.',
        answer: false
      },
      {
        id: 'f5',
        type: 'mcq',
        text: 'What is the maximum part-time work hours for international students?',
        options: ['20 hours', '24 hours', '30 hours', '16 hours'],
        answerIndex: 1
      },
      {
        id: 'f6',
        type: 'boolean',
        text: 'Turkey has over 200 universities.',
        answer: true
      },
      {
        id: 'f7',
        type: 'mcq',
        text: 'Turkish academic year typically runs from:',
        options: ['August to May', 'September to June', 'October to July', 'September to May'],
        answerIndex: 1
      },
      {
        id: 'f8',
        type: 'boolean',
        text: 'Living costs in Turkey are generally 40-60% lower than Western Europe.',
        answer: true
      },
      {
        id: 'f9',
        type: 'mcq',
        text: 'Turkey\'s government system is:',
        options: ['Parliamentary republic', 'Presidential republic', 'Constitutional monarchy', 'Federal republic'],
        answerIndex: 1
      },
      {
        id: 'f10',
        type: 'boolean',
        text: 'EU students can use their EHIC for health insurance in Turkey.',
        answer: true
      }
    ]
  }
];

export const SEED_ORDERS: Order[] = [
  {
    id: 'ORD-1001',
    userId: 'agent-1',
    title: 'Basic Agent Certification',
    currency: 'USD',
    amount: 0,
    status: 'unpaid',
    provider: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ORD-1002',
    userId: 'agent-1',
    courseId: 'course-1',
    title: 'Agent Training Course',
    currency: 'USD',
    amount: 50,
    status: 'unpaid',
    provider: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const SEED_INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'int-1',
    name: 'Generic Webhook',
    enabled: false
  },
  {
    id: 'int-2',
    name: 'n8n',
    enabled: false
  },
  {
    id: 'int-3',
    name: 'Kommo',
    enabled: false
  },
  {
    id: 'int-4',
    name: 'Google Sheets',
    enabled: false
  },
  {
    id: 'int-5',
    name: 'SMTP Mail',
    enabled: false
  },
  {
    id: 'int-6',
    name: 'Custom API',
    enabled: false
  }
];

export const SEED_PAYMENT_CONFIG: PaymentConfig = {
  enabled: false,
  provider: 'none'
};

export const SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Welcome to Find And Study Agents Portal',
    content: 'Complete your agent training to unlock full platform access and start helping students achieve their dreams.',
    active: true,
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_SUBSCRIPTION_PREFERENCES: SubscriptionPreferences = {
  enrolled: true,
  fiftyPercent: true,
  seventyFivePercent: true,
  completed: true
};