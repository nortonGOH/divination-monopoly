-- Preserve all questions and their existing categories, IDs, answers, history.
-- Extend ONLY the allowable values of public.quiz_questions.knowledge_type.
-- Apply atomically; on lock timeout or failed validation, PostgreSQL rolls back.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.quiz_questions
  DROP CONSTRAINT quiz_questions_knowledge_type_check;
ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_knowledge_type_check
  CHECK (knowledge_type = ANY (ARRAY[
    '山','醫','命','卜','相','式占','天文曆法','易學','待分類'
  ]::text[]));
COMMIT;
