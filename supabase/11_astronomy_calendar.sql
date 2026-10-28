-- v11: add separate astronomy/calendar challenge knowledge type.
-- Run after supabase/10_five_arts_quiz_type.sql. Non-destructive, retains other classifications.
BEGIN;
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS knowledge_type text NOT NULL DEFAULT '待分類';
ALTER TABLE public.quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_knowledge_type_check;
ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_knowledge_type_check
    CHECK (knowledge_type IN ('山','醫','命','卜','相','天文曆法','待分類'));
-- Correct prior v10 "曆法" assignment and imported calendar bank.
UPDATE public.quiz_questions
SET knowledge_type='天文曆法'
WHERE (category LIKE '%曆法%' OR category LIKE '%天文%'
       OR id LIKE 'calendar-%')
  AND knowledge_type IN ('命','待分類');
COMMIT;
SELECT knowledge_type, difficulty, count(*) AS questions
FROM public.quiz_questions
GROUP BY 1,2 ORDER BY 1,2;
