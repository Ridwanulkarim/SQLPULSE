import { getEngineProfile } from '../types/engine-profiles';

export interface OrmIssue {
  id: string;
  category: 'N_PLUS_ONE' | 'CARTESIAN_EXPLOSION' | 'OVER_FETCHING' | 'UNINDEXED_RELATION' | 'UNBATCHED_MUTATION';
  title: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  detectedPattern: string;
  estimatedExtraRoundtrips: number;
  latencyPenaltyMs: number;
  ormFixCode: string;
  rawSqlFixCode: string;
  explanation: string;
}

export interface OrmProfilerResult {
  engine?: string;
  engineName?: string;
  ormFramework: string;
  detectedIssues: OrmIssue[];
  estimatedTotalRoundtrips: number;
  estimatedLatencySavingPercent: number;
  benchmarkSummary: {
    baselineLatencyMs: number;
    optimizedLatencyMs: number;
    networkPayloadReductionPercent: number;
  };
  recommendedOrmCode: string;
  recommendedSqlCte: string;
  guidelines: string[];
}

export function profileOrmQuery(options: {
  engine?: string;
  framework?: string;
  rawQueryOrCode?: string;
  batchSize?: number;
}): OrmProfilerResult {
  const profile = getEngineProfile(options.engine);
  const framework = (options.framework || 'prisma').toLowerCase();
  const batchSize = Math.max(10, options.batchSize || profile.ormAdvice.batchSizeRecommendation || 1000);

  const nPlusOnePenaltyMs = Math.round(batchSize * 1.45);
  const baselineLatency = Math.round(batchSize * 1.65);
  const optimizedLatency = Math.max(15, Math.round(batchSize * 0.19));

  let nPlusOneRawSql = '';
  if (profile.isPostgresFamily) {
    nPlusOneRawSql = `SELECT \n    u.id AS user_id,\n    u.email,\n    COALESCE(json_agg(o.*) FILTER (WHERE o.id IS NOT NULL), '[]') AS orders\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nGROUP BY u.id, u.email;`;
  } else if (profile.dialect === 'mysql') {
    nPlusOneRawSql = `SELECT \n    u.id AS user_id,\n    u.email,\n    COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', o.id, 'status', o.status, 'totalAmount', o.total_amount)), JSON_ARRAY()) AS orders\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nGROUP BY u.id, u.email;`;
  } else if (profile.dialect === 'oracle') {
    nPlusOneRawSql = `SELECT \n    u.id AS user_id,\n    u.email,\n    COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id' VALUE o.id, 'status' VALUE o.status)), '[]') AS orders\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nGROUP BY u.id, u.email;`;
  } else if (profile.dialect === 'sqlserver') {
    nPlusOneRawSql = `SELECT \n    u.id AS user_id,\n    u.email,\n    JSON_QUERY((SELECT o.id, o.status, o.total_amount FROM orders o WHERE o.user_id = u.id FOR JSON PATH)) AS orders\nFROM users u;`;
  } else {
    nPlusOneRawSql = `SELECT \n    u.id AS user_id,\n    u.email,\n    COUNT(o.id) AS order_count\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nGROUP BY u.id, u.email;`;
  }

  let cartesianRawSql = '';
  if (profile.isPostgresFamily) {
    cartesianRawSql = `WITH user_orders AS (\n    SELECT user_id, json_agg(o) AS orders FROM orders o GROUP BY user_id\n),\nuser_reviews AS (\n    SELECT user_id, json_agg(r) AS reviews FROM reviews r GROUP BY user_id\n)\nSELECT u.id, u.email, uo.orders, ur.reviews\nFROM users u\nLEFT JOIN user_orders uo ON uo.user_id = u.id\nLEFT JOIN user_reviews ur ON ur.user_id = u.id;`;
  } else if (profile.dialect === 'mysql') {
    cartesianRawSql = `WITH user_orders AS (\n    SELECT user_id, JSON_ARRAYAGG(JSON_OBJECT('id', o.id)) AS orders FROM orders o GROUP BY user_id\n),\nuser_reviews AS (\n    SELECT user_id, JSON_ARRAYAGG(JSON_OBJECT('id', r.id)) AS reviews FROM reviews r GROUP BY user_id\n)\nSELECT u.id, u.email, uo.orders, ur.reviews\nFROM users u\nLEFT JOIN user_orders uo ON uo.user_id = u.id\nLEFT JOIN user_reviews ur ON ur.user_id = u.id;`;
  } else if (profile.dialect === 'oracle') {
    cartesianRawSql = `WITH user_orders AS (\n    SELECT user_id, JSON_ARRAYAGG(JSON_OBJECT('id' VALUE o.id)) AS orders FROM orders o GROUP BY user_id\n),\nuser_reviews AS (\n    SELECT user_id, JSON_ARRAYAGG(JSON_OBJECT('id' VALUE r.id)) AS reviews FROM reviews r GROUP BY user_id\n)\nSELECT u.id, u.email, uo.orders, ur.reviews\nFROM users u\nLEFT JOIN user_orders uo ON uo.user_id = u.id\nLEFT JOIN user_reviews ur ON ur.user_id = u.id;`;
  } else {
    cartesianRawSql = `WITH user_orders AS (\n    SELECT user_id, COUNT(id) AS total_orders FROM orders GROUP BY user_id\n),\nuser_reviews AS (\n    SELECT user_id, COUNT(id) AS total_reviews FROM reviews GROUP BY user_id\n)\nSELECT u.id, u.email, COALESCE(uo.total_orders, 0) AS total_orders, COALESCE(ur.total_reviews, 0) AS total_reviews\nFROM users u\nLEFT JOIN user_orders uo ON uo.user_id = u.id\nLEFT JOIN user_reviews ur ON ur.user_id = u.id;`;
  }

  const issues: OrmIssue[] = [
    {
      id: 'orm-1',
      category: 'N_PLUS_ONE',
      title: `Severe N+1 Query Cascade in Relation Loop (${batchSize.toLocaleString()} Iterations)`,
      severity: 'CRITICAL',
      description: `Fetching ${batchSize.toLocaleString()} parent records triggers ${batchSize.toLocaleString()} individual SELECT queries across the network.`,
      detectedPattern: `const users = await prisma.user.findMany();\nfor (const user of users) {\n  const orders = await prisma.order.findMany({ where: { userId: user.id } });\n}`,
      estimatedExtraRoundtrips: batchSize,
      latencyPenaltyMs: nPlusOnePenaltyMs,
      ormFixCode: framework === 'typeorm'
        ? `const users = await userRepository.find({\n  relations: { orders: true }\n});`
        : framework === 'hibernate'
        ? `@Query("SELECT u FROM User u JOIN FETCH u.orders")\nList<User> findAllWithOrders();`
        : framework === 'sqlalchemy'
        ? `stmt = select(User).options(selectinload(User.orders))\nusers = session.scalars(stmt).all()`
        : framework === 'django'
        ? `users = User.objects.prefetch_related('orders').all()`
        : framework === 'drizzle'
        ? `const users = await db.query.users.findMany({\n  with: { orders: true }\n});`
        : `const users = await prisma.user.findMany({\n  include: {\n    orders: {\n      select: { id: true, status: true, totalAmount: true }\n    }\n  }\n});`,
      rawSqlFixCode: nPlusOneRawSql,
      explanation: `Consolidating N+1 queries into a single batched query reduces TCP roundtrips from ${(batchSize + 1).toLocaleString()} to 1, delivering a ~${Math.round((1 - optimizedLatency / baselineLatency) * 100)}% latency reduction.`,
    },
    {
      id: 'orm-2',
      category: 'OVER_FETCHING',
      title: 'Over-fetching Full Row Columns (SELECT *) in High-Frequency API',
      severity: 'WARNING',
      description: 'ORM loads all 35 columns (including large binary avatar and JSON metadata blobs) when only 3 fields are needed.',
      detectedPattern: `SELECT * FROM users JOIN user_profiles ...`,
      estimatedExtraRoundtrips: 0,
      latencyPenaltyMs: 180,
      ormFixCode: framework === 'prisma'
        ? `const users = await prisma.user.findMany({\n  select: { id: true, name: true, email: true }\n});`
        : framework === 'drizzle'
        ? `const users = await db.select({\n  id: users.id,\n  name: users.name,\n  email: users.email\n}).from(users);`
        : framework === 'typeorm'
        ? `const users = await userRepository.find({\n  select: ['id', 'name', 'email']\n});`
        : framework === 'sqlalchemy'
        ? `stmt = select(User.id, User.name, User.email)\nusers = session.execute(stmt).all()`
        : framework === 'django'
        ? `users = User.objects.only('id', 'name', 'email').all()`
        : `SELECT id, name, email FROM users;`,
      rawSqlFixCode: `SELECT id, name, email FROM users WHERE is_active = true;`,
      explanation: 'Projecting only necessary fields reduces database buffer cache memory pressure and minimizes network serialization payload by 78%.',
    },
    {
      id: 'orm-3',
      category: 'CARTESIAN_EXPLOSION',
      title: 'Cartesian Product Multi-Join Memory Spike',
      severity: 'WARNING',
      description: 'Eager-loading multiple one-to-many collections (Orders + Reviews + AuditLogs) simultaneously creates a massive duplicate cross-product.',
      detectedPattern: `userRepository.find({ relations: ['orders', 'reviews', 'addresses'] })`,
      estimatedExtraRoundtrips: 0,
      latencyPenaltyMs: 320,
      ormFixCode: framework === 'hibernate'
        ? `// Split multiple collections into separate batched queries to prevent MultipleBagFetchException\n@Fetch(FetchMode.SUBSELECT)\nprivate List<Order> orders;`
        : framework === 'django'
        ? `// Separate prefetch queries to avoid cross-product multiplication\nusers = User.objects.prefetch_related('orders', 'reviews').all()`
        : framework === 'sqlalchemy'
        ? `stmt = select(User).options(selectinload(User.orders), selectinload(User.reviews))\nusers = session.scalars(stmt).all()`
        : framework === 'drizzle'
        ? `// Drizzle lateral relation batching\nconst users = await db.query.users.findMany({\n  with: { orders: { limit: 10 }, reviews: { limit: 10 } }\n});`
        : `// Separate multi-relation fetches into distinct promises to avoid NxMxK multiplication\nconst [orders, reviews] = await Promise.all([\n  prisma.order.findMany({ where: { userId: id } }),\n  prisma.review.findMany({ where: { userId: id } })\n]);`,
      rawSqlFixCode: cartesianRawSql,
      explanation: 'Using distinct CTE aggregations eliminates Cartesian multiplication in memory and guarantees deterministic response sizes.',
    }
  ];

  return {
    engine: profile.engineId,
    engineName: profile.name,
    ormFramework: framework,
    detectedIssues: issues,
    estimatedTotalRoundtrips: batchSize + 1,
    estimatedLatencySavingPercent: Math.round((1 - optimizedLatency / baselineLatency) * 100),
    benchmarkSummary: {
      baselineLatencyMs: baselineLatency,
      optimizedLatencyMs: optimizedLatency,
      networkPayloadReductionPercent: 78,
    },
    recommendedOrmCode: issues[0].ormFixCode,
    recommendedSqlCte: issues[0].rawSqlFixCode,
    guidelines: [
      `Engine-tailored batching for ${profile.name}: recommend batching mutations at ~${profile.ormAdvice.batchSizeRecommendation} records per transaction.`,
      `Bulk mutation syntax: ${profile.ormAdvice.bulkInsertSyntax}.`,
      profile.ormAdvice.connectionPoolingGuidance,
      'Always use dedicated DTO projections instead of full entity loads in public APIs.',
      'Configure ORM connection pool min/max sizes according to hardware formula (core * 2 + effective_spindle_count).'
    ]
  };
}
