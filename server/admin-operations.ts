import type { Express, RequestHandler } from 'express';
import { storage } from './storage';
import { db } from './db';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { analyticsMetrics, contentTranslations, quizTranslations, agencies as agencyTable, users as userTable } from '@shared/schema';
import { LANGUAGE_CODES } from '@shared/languages';

export function registerAdminOperations(app: Express, auth: RequestHandler, admin: RequestHandler) {
  // Record only action metadata, never request bodies, passwords or tokens.
  app.use('/api/admin', (req, res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        const actor = (req as any).user;
        if (actor && res.statusCode < 400) void storage.createAnalyticsMetric({
          userId: actor.id, metricType: 'admin_action',
          metricValue: JSON.stringify({ method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode })
        }).catch(() => console.error('Admin action history write failed'));
      });
    }
    next();
  });
  app.get('/api/admin/operations', auth, admin, async (_req, res) => {
    try {
      const [users, agencies, progresses, attempts, certificates, contents, quizzes, countries, history, lessonRows, quizRows] = await Promise.all([
        storage.getUsers(), storage.getAgencies(), storage.getProgresses(), storage.getAttempts(), storage.getCertificates(), storage.getContents(), storage.getQuizzes(), storage.getCountries(),
        db.select({ id: analyticsMetrics.id, userId: analyticsMetrics.userId, action: analyticsMetrics.metricValue, timestamp: analyticsMetrics.timestamp }).from(analyticsMetrics).where(eq(analyticsMetrics.metricType, 'admin_action')).orderBy(desc(analyticsMetrics.timestamp)).limit(200),
        db.select({ id: contentTranslations.contentId, language: contentTranslations.language, status: contentTranslations.status }).from(contentTranslations),
        db.select({ id: quizTranslations.quizId, language: quizTranslations.language, status: quizTranslations.status }).from(quizTranslations)
      ]);
      const now = Date.now();
      const agents = users.filter(u => u.role === 'agent').map(u => {
        const progress = progresses.filter(p => p.userId === u.id);
        const exams = attempts.filter(a => a.userId === u.id);
        const lastActivity = Math.max(0, ...progress.map(p => new Date(p.lastAccessed).getTime()), ...exams.map(a => new Date(a.date).getTime()));
        return { id: u.id, name: u.name, email: u.email, agencyId: u.agencyId, status: u.status, enrolled: progress.length, completed: progress.filter(p => p.percent >= 100).length, averageProgress: progress.length ? Math.round(progress.reduce((n,p) => n + Math.min(100,p.percent),0)/progress.length) : 0, lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null, notStarted: progress.length === 0, stalled: progress.some(p => p.percent < 100) && now-lastActivity > 14*86400000, struggling: exams.length >= 3 && exams.slice().sort((a,b) => +new Date(b.date)-+new Date(a.date)).slice(0,3).every(a => a.scorePercent < 70) };
      });
      const publishedLessons = contents.filter(c => c.status === 'published' && c.type === 'lesson');
      const activeQuizzes = quizzes.filter(q => q.status === 'active');
      const coverage = LANGUAGE_CODES.filter(l => l !== 'en').map(language => {
        const lessons = new Set(lessonRows.filter(r => r.language === language && r.status === 'published').map(r => r.id));
        const exams = new Set(quizRows.filter(r => r.language === language && r.status === 'published').map(r => r.id));
        return { language, missingLessons: publishedLessons.filter(c => !lessons.has(c.id)).map(c => ({id:c.id,title:c.title,countryId:c.countryId})), missingQuizzes: activeQuizzes.filter(q => !exams.has(q.id)).map(q => ({id:q.id,title:q.title,countryId:q.countryId})), drafts: lessonRows.filter(r=>r.language===language && r.status!=='published').length+quizRows.filter(r=>r.language===language && r.status!=='published').length };
      });
      res.json({ success: true, generatedAt: new Date().toISOString(), agencies: agencies.map(a=>({...a,primaryContactEmail:a.primaryContactEmail||a.contactEmail,phone:a.phone||a.contactPhone})), agents, coverage, history: history.map(h=>({...h,actor:users.find(u=>u.id===h.userId)?.name ?? 'Deleted user'})), countries, attempts: attempts.map(a=>({userId:a.userId,date:a.date,scorePercent:a.scorePercent})), certificates: certificates.map(c=>({userId:c.userId,issuedAt:c.issuedAt,scorePercent:c.scorePercent})), progresses: progresses.map(p=>({userId:p.userId,courseId:p.courseId,percent:p.percent,lastAccessed:p.lastAccessed})) });
    } catch { res.status(500).json({success:false,message:'Could not load operations data'}); }
  });
  app.post('/api/admin/operations/agencies/:id/merge', auth, admin, async (req,res) => {
    const {targetId,reason,expectedMemberIds}=req.body;
    if(typeof targetId!=='string'||targetId===req.params.id||typeof reason!=='string'||!reason.trim()||reason.length>1000||!Array.isArray(expectedMemberIds)||!expectedMemberIds.every(x=>typeof x==='string')) return res.status(400).json({success:false,message:'Two different agencies, member preview and a reason are required'});
    try {
      const result=await db.transaction(async tx=>{
        const locked=await tx.select().from(agencyTable).where(inArray(agencyTable.id,[req.params.id,targetId])).orderBy(asc(agencyTable.id)).for('update');
        const source=locked.find(a=>a.id===req.params.id),target=locked.find(a=>a.id===targetId);
        if(!source||!target)return {code:404,message:'Agency not found'};
        const key=(v:string)=>v.normalize('NFKC').toLocaleLowerCase().replace(new RegExp('[^\\p{L}\\p{N}]','gu'),'');
        if(source.status!=='active'||target.status!=='active'||!key(source.name)||key(source.name)!==key(target.name))return {code:409,message:'Only active duplicate-name agencies can be merged'};
        const members=await tx.select().from(userTable).where(eq(userTable.agencyId,source.id)).for('update');
        const memberIds=members.map(m=>m.id).sort();
        if(members.some(m=>m.role!=='agent')||JSON.stringify(memberIds)!==JSON.stringify([...expectedMemberIds].sort()))return {code:409,message:'Membership changed or contains non-agent accounts; refresh the preview'};
        await tx.update(userTable).set({agencyId:target.id}).where(eq(userTable.agencyId,source.id));
        await tx.update(agencyTable).set({status:'inactive'}).where(eq(agencyTable.id,source.id));
        await tx.insert(analyticsMetrics).values({userId:(req as any).user.id,metricType:'admin_action',metricValue:JSON.stringify({operation:'agency_merge',sourceId:source.id,targetId:target.id,sourceName:source.name,targetName:target.name,memberIds,reason:reason.trim(),previousSourceStatus:source.status})});
        return {code:200,moved:memberIds.length};
      });
      if(result.code!==200)return res.status(result.code).json({success:false,message:result.message});
      res.json({success:true,moved:result.moved});
    }catch{res.status(500).json({success:false,message:'Merge could not be saved'});}
  });
  app.post('/api/admin/operations/agencies/:id/decision', auth, admin, async (req, res) => {
    const {decision,reason}=req.body;
    if (!['approve','reject'].includes(decision) || typeof reason !== 'string' || !reason.trim() || reason.length>1000) return res.status(400).json({success:false,message:'Decision and a reason (1–1000 characters) are required'});
    try {
      const outcome = await db.transaction(async tx => {
        const [agency] = await tx.select().from(agencyTable).where(eq(agencyTable.id,req.params.id)).for('update');
        if (!agency) return {code:404,message:'Agency not found'};
        if (agency.status!=='pending') return {code:409,message:'Only pending applications can be reviewed'};
        const [updated] = await tx.update(agencyTable).set({status:decision==='approve'?'active':'inactive'}).where(eq(agencyTable.id,agency.id)).returning();
        if (decision==='approve') await tx.update(userTable).set({status:'active'}).where(and(eq(userTable.agencyId,agency.id),eq(userTable.role,'agent'),eq(userTable.status,'inactive')));
        await tx.insert(analyticsMetrics).values({userId:(req as any).user.id,metricType:'admin_action',metricValue:JSON.stringify({agencyId:agency.id,decision,reason:reason.trim()})});
        return {code:200,agency:updated};
      });
      if (outcome.code!==200) return res.status(outcome.code).json({success:false,message:outcome.message});
      res.json({success:true,agency:outcome.agency});
    } catch {res.status(500).json({success:false,message:'Could not save the application decision'});}
  });
}
