// Traductions simplifiées pour l'app mobile opérateur
export const translations = {
  fr: {
    // Login
    'login.title': 'OK Démarrage',
    'login.subtitle': 'LEONI — Opérateur',
    'login.matricule': 'Matricule',
    'login.matriculePlaceholder': 'Ex: OP-12345',
    'login.password': 'Mot de passe',
    'login.passwordPlaceholder': '••••••••',
    'login.submit': 'Connexion',
    'login.loading': 'Connexion...',
    'login.error': 'Identifiants incorrects',
    'login.errorGeneric': 'Erreur de connexion',
    'login.forgotPassword': 'Mot de passe oublié ?',
    'login.secure': 'Connexion sécurisée LEONI',

    // Stepper
    'step.session': 'Session',
    'step.machine': 'Machine',
    'step.checklist': 'Checklist',

    // Session step
    'session.title': 'Choisir la session',
    'session.subtitle': "Sélectionnez votre quart de travail",
    'session.morning': 'Matin',
    'session.morningHours': '06h – 14h',
    'session.evening': 'Soir',
    'session.eveningHours': '14h – 22h',
    'session.night': 'Nuit',
    'session.nightHours': '22h – 06h',

    // Machine step
    'machine.title': 'Choisir la machine',
    'machine.subtitle': 'Processus',
    'machine.empty': 'Aucune machine disponible',
    'machine.blocked': 'Déjà utilisée',

    // Checklist step
    'checklist.title': 'Évaluation',
    'checklist.instructions': 'Consignes',
    'checklist.show': 'Voir les consignes',
    'checklist.hide': 'Masquer',
    'checklist.evaluation': 'Évaluation',
    'checklist.comment': 'Commentaire',
    'checklist.commentOptional': 'Commentaire (optionnel)…',
    'checklist.commentRequired': 'Commentaire recommandé…',
    'checklist.referenceImage': 'Image de référence',
    'checklist.allGood': 'Tout conforme',
    'checklist.criteria': 'critères',

    // Results
    'result.VERT': 'Conforme',
    'result.ROUGE': 'Non conforme',
    'result.JAUNE': 'Surveillance',
    'result.NA': 'N/A',

    // Types
    'type.SECURITE': 'Sécurité',
    'type.QUALITE': 'Qualité',
    'type.TECHNIQUE': 'Technique',

    // Submit
    'submit.btn': 'Soumettre',
    'submit.withIssues': 'Soumettre ({n} anomalie(s))',
    'submit.loading': 'Envoi...',
    'submit.back': 'Retour',

    // Already submitted
    'submitted.title': 'Déjà soumise',
    'submitted.msg': 'Une checklist a déjà été soumise pour',
    'submitted.session': 'session',
    'submitted.changeMachine': 'Changer de machine',
    'submitted.view': 'Voir ma checklist',

    // Machine occupied
    'occupied.title': 'Machine occupée',
    'occupied.msg': 'Cette machine a déjà reçu une checklist pour ce processus sur cette session.',
    'occupied.change': 'Changer de machine',

    // Success
    'success.title': 'Soumis avec succès !',
    'success.subtitle': 'Checklist enregistrée',
    'success.tracking': 'Suivi de validation',
    'success.waiting': 'En attente du chef de ligne',
    'success.newChecklist': 'Nouvelle checklist',
    'success.conforme': 'Conforme',
    'success.surveillance': 'Surveillance',
    'success.nonConforme': 'Non conforme',
    'success.na': 'N/A',

    // Validation steps
    'val.submitted': 'Soumis',
    'val.validatedN1': 'Validé N1',
    'val.validatedN2': 'Validé N2',
    'val.validatedFinal': 'Final',

    // Errors
    'error.sessionNotSelected': 'Veuillez sélectionner une session',
    'error.machineNotSelected': 'Veuillez sélectionner une machine',
    'error.noResponses': 'Aucune réponse à soumettre',
    'error.userNotAuth': 'Utilisateur non authentifié',
    'error.alreadySubmitted': 'Cette machine a déjà été validée aujourd\'hui.',
    'error.serverUnreachable': 'Serveur inaccessible',

    // Misc
    'common.loading': 'Chargement…',
    'common.checking': 'Vérification…',
    'common.today': "Aujourd'hui",
    'common.logout': 'Déconnexion',
    'common.profile': 'Mon profil',
    'common.back': 'Retour',
    'common.process': 'Processus',
    'common.instructions.1': 'Mettre "1" si la tâche est OK',
    'common.instructions.2': 'Mettre "0" si la tâche est NOK',
    'common.instructions.3': 'Mettre "NA" si Non Applicable',
    'common.instructions.4': 'En cas de "0" : carte rouge LTPM, alerter le contremaître',
  },

  ar: {
    'login.title': 'بدء التشغيل',
    'login.subtitle': 'LEONI — المشغّل',
    'login.matricule': 'رقم التسجيل',
    'login.matriculePlaceholder': 'مثال: OP-12345',
    'login.password': 'كلمة المرور',
    'login.passwordPlaceholder': '••••••••',
    'login.submit': 'تسجيل الدخول',
    'login.loading': 'جارٍ الدخول...',
    'login.error': 'بيانات الدخول غير صحيحة',
    'login.errorGeneric': 'خطأ في الاتصال',
    'login.forgotPassword': 'نسيت كلمة المرور؟',
    'login.secure': 'اتصال آمن LEONI',

    'step.session': 'الوردية',
    'step.machine': 'الآلة',
    'step.checklist': 'القائمة',

    'session.title': 'اختيار الوردية',
    'session.subtitle': 'اختر وردية العمل',
    'session.morning': 'صباح',
    'session.morningHours': '06:00 – 14:00',
    'session.evening': 'مساء',
    'session.eveningHours': '14:00 – 22:00',
    'session.night': 'ليل',
    'session.nightHours': '22:00 – 06:00',

    'machine.title': 'اختيار الآلة',
    'machine.subtitle': 'العملية',
    'machine.empty': 'لا توجد آلات متاحة',
    'machine.blocked': 'مستخدمة بالفعل',

    'checklist.title': 'التقييم',
    'checklist.instructions': 'التعليمات',
    'checklist.show': 'عرض التعليمات',
    'checklist.hide': 'إخفاء',
    'checklist.evaluation': 'التقييم',
    'checklist.comment': 'تعليق',
    'checklist.commentOptional': 'تعليق (اختياري)...',
    'checklist.commentRequired': 'التعليق مستحسن...',
    'checklist.referenceImage': 'الصورة المرجعية',
    'checklist.allGood': 'الكل مطابق',
    'checklist.criteria': 'معايير',

    'result.VERT': 'مطابق',
    'result.ROUGE': 'غير مطابق',
    'result.JAUNE': 'مراقبة',
    'result.NA': 'لا ينطبق',

    'type.SECURITE': 'الأمان',
    'type.QUALITE': 'الجودة',
    'type.TECHNIQUE': 'تقني',

    'submit.btn': 'إرسال',
    'submit.withIssues': 'إرسال ({n} خلل)',
    'submit.loading': 'جارٍ الإرسال...',
    'submit.back': 'رجوع',

    'submitted.title': 'تم الإرسال مسبقاً',
    'submitted.msg': 'تم إرسال قائمة لـ',
    'submitted.session': 'الوردية',
    'submitted.changeMachine': 'تغيير الآلة',
    'submitted.view': 'عرض القائمة',

    'occupied.title': 'الآلة مشغولة',
    'occupied.msg': 'هذه الآلة استقبلت قائمة تدقيق لهذه العملية في هذه الوردية.',
    'occupied.change': 'تغيير الآلة',

    'success.title': 'تم الإرسال!',
    'success.subtitle': 'تم حفظ القائمة',
    'success.tracking': 'متابعة التحقق',
    'success.waiting': 'في انتظار رئيس الخط',
    'success.newChecklist': 'قائمة جديدة',
    'success.conforme': 'مطابق',
    'success.surveillance': 'مراقبة',
    'success.nonConforme': 'غير مطابق',
    'success.na': 'لا ينطبق',

    'val.submitted': 'أُرسل',
    'val.validatedN1': 'معتمد N1',
    'val.validatedN2': 'معتمد N2',
    'val.validatedFinal': 'نهائي',

    'error.sessionNotSelected': 'الرجاء اختيار الوردية',
    'error.machineNotSelected': 'الرجاء اختيار الآلة',
    'error.noResponses': 'لا توجد إجابات للإرسال',
    'error.userNotAuth': 'المستخدم غير مصادق عليه',
    'error.alreadySubmitted': 'تم التحقق من هذه الآلة اليوم.',
    'error.serverUnreachable': 'الخادم غير متاح',

    'common.loading': 'جارٍ التحميل...',
    'common.checking': 'جارٍ التحقق...',
    'common.today': 'اليوم',
    'common.logout': 'تسجيل الخروج',
    'common.profile': 'ملفي',
    'common.back': 'رجوع',
    'common.process': 'العملية',
    'common.instructions.1': 'ضع "1" إذا كانت المهمة على ما يرام',
    'common.instructions.2': 'ضع "0" إذا كانت المهمة غير صحيحة',
    'common.instructions.3': 'ضع "NA" إذا كان غير قابل للتطبيق',
    'common.instructions.4': 'في حالة "0": بطاقة LTPM الحمراء، تنبيه المشرف',
  },
};

export function t(key, lang = 'fr', vars = {}) {
  const dict = translations[lang] || translations.fr;
  let str = dict[key] || translations.fr[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(`{${k}}`, v);
  });
  return str;
}
