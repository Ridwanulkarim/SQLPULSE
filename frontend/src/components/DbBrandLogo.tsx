import React from 'react';

interface DbBrandLogoProps {
  engineId: string;
  className?: string;
  size?: number;
}

export const DbBrandLogo: React.FC<DbBrandLogoProps> = ({
  engineId,
  className = '',
  size = 20,
}) => {
  const normalized = (engineId || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized.includes('postgres') || normalized.includes('neon') || normalized.includes('timescale') && normalized.includes('pg')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#336791" />
        <path
          d="M17.5 12.8c-.2-1.3-.8-2.5-1.8-3.3-1-.8-2.3-1.2-3.7-1.1-.9.1-1.8.4-2.5 1-.6.5-1.1 1.2-1.3 2-.3.9-.2 1.9.1 2.8.3.8.8 1.6 1.5 2.1.7.5 1.6.8 2.5.8h.4c.5 0 .9-.1 1.4-.3.4-.2.8-.5 1.1-.9.4-.5.7-1.1.9-1.7.2-.5.4-.9.5-1.4z"
          fill="#FFFFFF"
        />
        <path
          d="M8.2 11.4c-.4.5-.6 1.1-.6 1.8 0 .8.3 1.6.8 2.2.3.4.7.7 1.2.9-.2-.7-.3-1.4-.2-2.1.1-.8.4-1.6.9-2.2-.7-.3-1.5-.1-2.1-.6z"
          fill="#A4C2F4"
        />
        <circle cx="14.5" cy="11.5" r="0.9" fill="#336791" />
      </svg>
    );
  }

  if (normalized.includes('mysql') || normalized.includes('percona') || normalized.includes('mariadb')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#00758F" />
        <path
          d="M18 10.5c-.8-1.5-2.2-2.7-3.8-3.3-1.2-.4-2.5-.4-3.7-.1-1.2.3-2.3.9-3.2 1.8-.8.8-1.4 1.8-1.6 2.9-.3 1.1-.1 2.3.4 3.3.4.8 1 1.5 1.8 2 .8.5 1.7.7 2.6.7.8 0 1.6-.2 2.3-.5.7-.3 1.3-.8 1.8-1.4.5-.6.9-1.3 1.1-2.1.4-1.1.9-2.2 2.3-3.3z"
          fill="#F29111"
        />
        <path
          d="M13.5 11c-.5-.8-1.2-1.5-2-1.9-.8-.4-1.7-.5-2.6-.4-.8.1-1.6.5-2.2 1-.6.5-1 1.2-1.2 2 .5-.3 1.1-.4 1.7-.4.6 0 1.2.2 1.7.5.5.3 1 .8 1.4 1.3.4.6.9 1.1 1.5 1.5.5.3 1.1.4 1.7.3.5-.1 1-.4 1.4-.8.4-.4.7-.9.8-1.4.1-.6 0-1.2-.5-1.7z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (normalized.includes('oracle')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#F80000" />
        <path
          d="M7.5 8h9a4 4 0 014 4v0a4 4 0 01-4 4h-9a4 4 0 01-4-4v0a4 4 0 014-4z"
          stroke="#FFFFFF"
          strokeWidth="2.5"
        />
      </svg>
    );
  }

  if (normalized.includes('sqlserver') || normalized.includes('mssql') || normalized.includes('microsoft')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#CC292B" />
        <ellipse cx="12" cy="7" rx="6" ry="2.5" fill="#FFFFFF" />
        <path d="M6 7v4c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V7" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
        <path d="M6 11v4c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5v-4" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
      </svg>
    );
  }

  if (normalized.includes('mongo')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#001E2B" />
        <path
          d="M12 4c-.3 1.2-1.5 3-2.5 4.8C8.3 11 7.5 13.2 7.5 15.3c0 2.6 1.8 4.7 4.5 4.7 2.7 0 4.5-2.1 4.5-4.7 0-2.1-.8-4.3-2-6.5C13.5 7 12.3 5.2 12 4z"
          fill="#00ED64"
        />
        <path
          d="M12 4v16c.3 0 .7-.1 1-.2.8-.3 1.5-.9 2-1.6.6-.8.9-1.8.9-2.9 0-2.1-.8-4.3-2-6.5C13.1 7 12.3 5.2 12 4z"
          fill="#00C450"
        />
        <path d="M12 18.5v2.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (normalized.includes('redis') || normalized.includes('keydb') || normalized.includes('valkey') || normalized.includes('dragonfly')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#DC382D" />
        <path
          d="M12 6l6 3.5-6 3.5-6-3.5L12 6z"
          fill="#FFFFFF"
        />
        <path
          d="M6 10.5l6 3.5v4l-6-3.5v-4z"
          fill="#E5E7EB"
        />
        <path
          d="M18 10.5l-6 3.5v4l6-3.5v-4z"
          fill="#D1D5DB"
        />
        <circle cx="12" cy="9.5" r="1" fill="#DC382D" />
      </svg>
    );
  }

  if (normalized.includes('clickhouse')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#FAFAFA" />
        <rect x="5" y="10" width="2" height="4" rx="0.8" fill="#F8C008" />
        <rect x="8" y="7" width="2" height="10" rx="0.8" fill="#F8C008" />
        <rect x="11" y="5" width="2" height="14" rx="0.8" fill="#FF5E00" />
        <rect x="14" y="8" width="2" height="8" rx="0.8" fill="#FF5E00" />
        <rect x="17" y="11" width="2" height="2" rx="0.8" fill="#F8C008" />
      </svg>
    );
  }

  if (normalized.includes('duckdb')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#FFF000" />
        <circle cx="10" cy="10" r="4.5" fill="#000000" />
        <circle cx="11.5" cy="8.5" r="1" fill="#FFF000" />
        <path d="M14 10.5h4.5l-2 3H14v-3z" fill="#FF7700" />
        <path d="M6 14.5c0-2.5 3-4.5 7-4.5 2.5 0 5 1 5 3.5 0 2.5-3 5-7 5s-5-1.5-5-4z" fill="#000000" />
      </svg>
    );
  }

  if (normalized.includes('sqlite') || normalized.includes('turso') || normalized.includes('libsql')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#003B57" />
        <path
          d="M6 15c0-4.5 4-8 10-9-1.5 2.5-2.5 5.5-2 8.5-2.5-1-5.5-.5-8 .5z"
          fill="#00ADEF"
        />
        <path
          d="M8.5 16.5c3-1 6.5-1.5 9-4.5-.5 3-2 5.5-5 6.5-1.5.5-3 .5-4-2z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (normalized.includes('snowflake')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#29B5E8" />
        <path
          d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M6.3 17.7L17.7 6.3"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
      </svg>
    );
  }

  if (normalized.includes('neo4j') || normalized.includes('memgraph') || normalized.includes('graph')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#018BFF" />
        <line x1="7" y1="16" x2="16" y2="8" stroke="#FFFFFF" strokeWidth="2" />
        <line x1="16" y1="8" x2="17" y2="16" stroke="#FFFFFF" strokeWidth="2" />
        <line x1="7" y1="16" x2="17" y2="16" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="7" cy="16" r="3" fill="#FFFFFF" />
        <circle cx="16" cy="8" r="3.5" fill="#00D4AA" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="17" cy="16" r="2.5" fill="#FFFFFF" />
      </svg>
    );
  }

  if (normalized.includes('cassandra') || normalized.includes('scylla') || normalized.includes('hbase')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#1565C0" />
        <circle cx="12" cy="12" r="6.5" stroke="#FFFFFF" strokeWidth="1.8" fill="none" strokeDasharray="2.5 1.5" />
        <circle cx="12" cy="5.5" r="1.8" fill="#42A5F5" />
        <circle cx="18.5" cy="12" r="1.8" fill="#42A5F5" />
        <circle cx="12" cy="18.5" r="1.8" fill="#42A5F5" />
        <circle cx="5.5" cy="12" r="1.8" fill="#42A5F5" />
      </svg>
    );
  }

  if (normalized.includes('elastic') || normalized.includes('opensearch') || normalized.includes('solr')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#005571" />
        <circle cx="12" cy="12" r="6" stroke="#00BFB3" strokeWidth="2.5" fill="none" />
        <circle cx="12" cy="12" r="2.5" fill="#FED10A" />
      </svg>
    );
  }

  if (normalized.includes('supabase')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#1C1C1C" />
        <path
          d="M13.5 4.5L5.5 14.5h5.5l-1.5 5 8-10h-5.5l1.5-5z"
          fill="#3ECF8E"
        />
      </svg>
    );
  }

  if (normalized.includes('dynamo') || normalized.includes('amazon') || normalized.includes('aurora') || normalized.includes('redshift')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#232F3E" />
        <path
          d="M12 4.5l6 3.5v7l-6 3.5-6-3.5v-7l6-3.5z"
          fill="#3B82F6"
        />
        <path
          d="M12 4.5l6 3.5-6 3.5-6-3.5 6-3.5z"
          fill="#60A5FA"
        />
        <path
          d="M12 11.5v7l6-3.5v-7l-6 3.5z"
          fill="#1D4ED8"
        />
      </svg>
    );
  }

  if (normalized.includes('cockroach')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#6933FF" />
        <path
          d="M12 5l5 2.5v5c0 3.5-2.5 6.5-5 7.5-2.5-1-5-4-5-7.5v-5L12 5z"
          fill="#00EA91"
        />
        <circle cx="12" cy="11" r="2" fill="#6933FF" />
      </svg>
    );
  }

  if (normalized.includes('vector') || normalized.includes('weaviate') || normalized.includes('pinecone') || normalized.includes('milvus') || normalized.includes('qdrant') || normalized.includes('chroma')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect width="24" height="24" rx="6" fill="#0F172A" />
        <path d="M6 18L18 6M18 6H10M18 6V14" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="18" r="2.5" fill="#38BDF8" />
        <circle cx="18" cy="6" r="2.5" fill="#F43F5E" />
      </svg>
    );
  }

  const initials = engineId ? engineId.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() : 'DB';
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-lg bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center font-mono font-black text-[10px] shadow-xs border border-white/20 select-none shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
};
