SELECT 
    t.typname AS enum_name,
    g.enum_values
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN (
    SELECT 
        enumtypid, 
        string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS enum_values
    FROM pg_enum
    GROUP BY enumtypid
) g ON g.enumtypid = t.oid
WHERE n.nspname = 'public';
