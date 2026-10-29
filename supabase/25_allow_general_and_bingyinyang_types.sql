-- Extend only the allowed values of quiz_questions.knowledge_type.
-- Do not update or reclassify any existing quiz questions.
-- Repeat-safe, transactional and guarded against unforeseen constraint changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  current_check text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO current_check
  FROM pg_constraint
  WHERE conrelid = 'public.quiz_questions'::regclass
    AND conname = 'quiz_questions_knowledge_type_check';
  IF current_check IS NULL OR current_check NOT LIKE '%式占%'
     OR current_check NOT LIKE '%天文曆法%' THEN
    RAISE EXCEPTION 'Existing quiz knowledge-type constraint differs; stop for review';
  END IF;
  IF current_check LIKE '%通識%' AND current_check LIKE '%兵陰陽%' THEN
    RETURN;
  END IF;
  ALTER TABLE public.quiz_questions
    DROP CONSTRAINT quiz_questions_knowledge_type_check;
  ALTER TABLE public.quiz_questions
    ADD CONSTRAINT quiz_questions_knowledge_type_check
    CHECK (knowledge_type = ANY (ARRAY[
      '山','醫','命','卜','相','式占','兵陰陽','通識','天文曆法','易學','待分類'
    ]::text[]));
END $$;
COMMIT;
