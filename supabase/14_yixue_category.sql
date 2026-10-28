BEGIN;
ALTER TABLE public.quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_knowledge_type_check;
ALTER TABLE public.quiz_questions ADD CONSTRAINT quiz_questions_knowledge_type_check
CHECK(knowledge_type IN ('山','醫','命','卜','相','天文曆法','易學','待分類'));
UPDATE public.quiz_questions SET knowledge_type='易學'
WHERE (category IN ('易學基礎','八卦','易學') OR id LIKE 'yixue-choice-%')
AND knowledge_type IN ('卜','待分類');
COMMIT;
NOTIFY pgrst,'reload schema';