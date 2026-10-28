#!/usr/bin/env python3
"""Apply v20 integration to a fresh checkout of divination-monopoly.
Usage: python 04_apply_frontend_patch.py /path/to/divination-monopoly
Does not contact GitHub or Supabase, and will not silently overwrite old changes.
"""
from pathlib import Path
import re,sys,shutil

if len(sys.argv)!=2:
 raise SystemExit('Usage: python 04_apply_frontend_patch.py /path/to/divination-monopoly')
root=Path(sys.argv[1]).resolve(); page=root/'index.html'; member=root/'quiz-challenge-v7.js'
if not page.is_file() or not member.is_file(): raise SystemExit('Missing index.html or quiz-challenge-v7.js in '+str(root))
s=page.read_text(encoding='utf-8');m=member.read_text(encoding='utf-8')
if 'challenge-v20-wenchang.js' in s:raise SystemExit('Appears already patched. No changes made.')

def exact(old,new,src,label):
 if old not in src:raise RuntimeError('Cannot locate '+label+'; inspect current source manually.')
 return src.replace(old,new,1)

def func(name,replacement,src):
 pat=r'(?m)^async function '+re.escape(name)+r'\([^\n]*\)\{[\s\S]*?^\}'
 result,n=re.subn(pat,lambda match:replacement,src,count=1)
 if n!=1:raise RuntimeError('Unable to replace '+name)
 return result

# The public question list must not receive answer/explanation fields.
s=exact('const answer=Number(q.answer);',
        "const answer=q.answer==null?0:Number(q.answer); // Public answer is intentionally omitted. Never grade locally.",s,'validBank answer adapter')
s=func('fetchCloudBank', '''async function fetchCloudBank(){
  const admin=Boolean(adminAccessToken);
  const endpoint=admin?'quiz_admin_full_question_bank':'quiz_public_question_bank';
  const data=await cloudCall('/rest/v1/rpc/'+endpoint,
    {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'},admin);
  if(!Array.isArray(data))throw new Error('題庫 RPC 回傳格式不正確');
  return validBank(data);
}''',s)
s=func('upsertCloud', '''async function upsertCloud(questions){
  await cloudCall('/rest/v1/rpc/quiz_admin_upsert_questions',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({p_payload:questions})
  },true);
}''',s)
s=func('removeCloud', '''async function removeCloud(id){
  await cloudCall('/rest/v1/rpc/quiz_admin_delete_question',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({p_id:id})
  },true);
}''',s)
# The existing admin login must refresh full answers under admin's own JWT.
s=exact('      adminEmail=email;','      adminEmail=email;\n      await persistBank();',s,'admin-login refresh')
# Forget private answer data after administrator signs out.
s=exact("  adminAccessToken=null;adminEmail=null;\n  if(old)try", "  adminAccessToken=null;adminEmail=null;\n  questionBank=[];\n  await initializeBank();\n  if(old)try",s,'admin-logout reload')
s=exact('</body>', '<script src="./challenge-v20-wenchang.js"></script>\n</body>',s,'script inclusion')
# Make member token available only in memory to the rescue UI (not storage).
pat=r'(?m)^(\s*let\s+playerToken\s*=\s*null\s*,[^\n]*;)'
if re.search(pat,m):
 m=re.sub(pat,lambda x:x.group(1)+'\nwindow.quizMemberToken=()=>playerToken;',m,count=1)
else:
 raise RuntimeError('Member token declaration has changed; cannot patch safely')
old='detail:{correct:result.correct,questionId:activeQuestion.id}'
new='detail:{correct:result.correct,questionId:activeQuestion.id,administratorExempt:result.administrator_exempt,canRescue:result.wenchang_rescue_available}'
if old not in m:raise RuntimeError('Unable to locate server-verified quiz-answer-graded event')
m=m.replace(old,new,1)
for path in (page,member):
 shutil.copyfile(path, path.with_suffix(path.suffix+'.v20-backup'))
page.write_text(s,encoding='utf-8');member.write_text(m,encoding='utf-8')
shutil.copyfile(Path(__file__).with_name('challenge-v20-wenchang.js'),root/'challenge-v20-wenchang.js')
print('Prepared index.html, quiz-challenge-v7.js, challenge-v20-wenchang.js. Review differences before deployment.')
