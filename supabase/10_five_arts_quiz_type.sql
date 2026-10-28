-- v10: five-arts classification separate from existing category. Safe, additive migration.
BEGIN;
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS knowledge_type text NOT NULL DEFAULT '待分類';
UPDATE public.quiz_questions
SET knowledge_type = CASE
  WHEN category IN ('易學基礎','八卦','九宮','奇門遁甲','六壬','太乙','二·易卦、圖書與時空模型','二·三式高階機理與局數推衍') THEN '卜'
  WHEN category IN ('二十八宿','干支','五行','曆法','一·干支與五行基礎') THEN '命'
  ELSE '待分類'
END
WHERE knowledge_type = '待分類';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='quiz_questions_knowledge_type_check'
      AND conrelid='public.quiz_questions'::regclass
  ) THEN
    ALTER TABLE public.quiz_questions ADD CONSTRAINT quiz_questions_knowledge_type_check
      CHECK (knowledge_type IN ('山','醫','命','卜','相','待分類'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS quiz_questions_knowledge_type_idx
  ON public.quiz_questions (knowledge_type, difficulty, mansion);
COMMIT;
-- Verification:
SELECT knowledge_type,difficulty,count(*) AS question_count
FROM public.quiz_questions GROUP BY 1,2 ORDER BY 1,2;
