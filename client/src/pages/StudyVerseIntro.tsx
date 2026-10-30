import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Coins,
  Flame,
  GraduationCap,
  Layers3,
  LockKeyhole,
  Medal,
  Sparkles,
  Store,
  Target,
  Trophy,
  UsersRound,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Layers3,
    color: "mint",
    title: "4方向で、覚え方まで記録",
    text: "GREAT・MISS・THINK・ESCAPE。正解だけでは分からない、あなたの反応を学習履歴に残します。",
  },
  {
    icon: Trophy,
    color: "violet",
    title: "モンスターと一緒に成長",
    text: "学習時間とミッションが進化につながるから、毎日の小さな学習が目に見える成果になります。",
  },
  {
    icon: Store,
    color: "peach",
    title: "教材を見つけて、育てて、共有",
    text: "マーケットで教材を探したり、自分の単語帳を出品したり。学びの輪が自然に広がります。",
  },
];

const steps = [
  ["01", "学校・個人を選ぶ", "アカウントでログインして、あなたの学習空間へ。"],
  ["02", "教材を選ぶ", "単語帳、保存済みセット、マーケット教材から始めます。"],
  ["03", "4方向で答える", "分かった速さや迷いまで、スワイプで直感的に記録。"],
];

export default function StudyVerseIntro() {
  return (
    <main className="intro-page">
      <nav className="intro-nav" aria-label="紹介サイトのナビゲーション">
        <a href="/about" className="intro-logo" aria-label="StudyVerse紹介ページ">
          <span className="intro-logo-mark"><Sparkles className="h-4 w-4" /></span>
          <span>StudyVerse</span>
        </a>
        <div className="hidden items-center gap-6 text-sm font-bold text-slate-500 md:flex">
          <a href="#features">できること</a>
          <a href="#how-it-works">使い方</a>
          <a href="#classroom">教室で使う</a>
        </div>
        <a href="/" className="intro-nav-cta">アプリを開く <ArrowRight className="h-4 w-4" /></a>
      </nav>

      <section className="intro-hero">
        <div className="intro-hero-copy">
          <p className="intro-kicker"><span /> 学びの軌道をつくる、学習空間</p>
          <h1>覚える時間を、<br /><em>成長が見える時間</em>へ。</h1>
          <p className="intro-lead">StudyVerseは、単語帳・カード学習・ミッション・教室をひとつにつなぐ学習プラットフォームです。毎日の数分を、続けられる体験に変えます。</p>
          <div className="intro-actions">
            <a href="/" className="intro-primary">無料で始める <ArrowRight className="h-5 w-5" /></a>
            <a href="#features" className="intro-secondary">機能を見る <ChevronRight className="h-4 w-4" /></a>
          </div>
          <div className="intro-proof"><span><Check className="h-4 w-4" /> 登録はかんたん</span><span><Check className="h-4 w-4" /> スマホ対応</span><span><Check className="h-4 w-4" /> オフラインでも一部利用</span></div>
        </div>
        <div className="intro-hero-visual" aria-label="StudyVerseの学習画面イメージ">
          <div className="intro-orbit intro-orbit-a" /><div className="intro-orbit intro-orbit-b" />
          <div className="intro-phone-shadow" />
          <div className="intro-phone">
            <div className="intro-phone-notch" />
            <div className="intro-phone-top"><span>StudyVerse</span><span className="intro-status-dot" /></div>
            <div className="intro-phone-greeting"><small>GOOD MORNING</small><strong>今日も、少しずつ。</strong></div>
            <div className="intro-progress-card"><div><small>総合学習時間</small><strong>18<span>時間 42分</span></strong></div><div className="intro-ring"><span>68%</span></div></div>
            <div className="intro-mini-grid"><div><Flame className="h-4 w-4 text-orange-400" /><b>7日</b><small>連続学習</small></div><div><Target className="h-4 w-4 text-violet-500" /><b>82%</b><small>正答率</small></div></div>
            <div className="intro-phone-section"><small>今日の学習</small><div className="intro-study-row"><span className="intro-study-icon mint"><BookOpen className="h-4 w-4" /></span><div><b>高校英単語 core</b><small>あと 10問</small></div><ArrowRight className="ml-auto h-4 w-4 text-slate-400" /></div><div className="intro-study-row"><span className="intro-study-icon violet"><Trophy className="h-4 w-4" /></span><div><b>デイリーミッション</b><small>3 / 4 完了</small></div><ArrowRight className="ml-auto h-4 w-4 text-slate-400" /></div></div>
            <div className="intro-phone-nav"><span className="active"><BookOpen className="h-4 w-4" />学習</span><span><Store className="h-4 w-4" />マーケット</span><span><UsersRound className="h-4 w-4" />教室</span></div>
          </div>
          <div className="intro-float-card intro-float-card-a"><span className="intro-float-icon"><Zap className="h-4 w-4" /></span><div><b>今日のミッション達成!</b><small>モンスターが育ちました</small></div></div>
          <div className="intro-float-card intro-float-card-b"><span className="intro-coin"><Coins className="h-4 w-4" /></span><b>+200 コイン</b></div>
        </div>
      </section>

      <section className="intro-trust"><p>ひとりでも、教室でも。学び方はあなたのペースで。</p><div><span><GraduationCap className="h-5 w-5" /> SCHOOL</span><span><LockKeyhole className="h-5 w-5" /> PRIVATE</span><span><Medal className="h-5 w-5" /> YOUR PROGRESS</span></div></section>

      <section id="features" className="intro-section intro-features"><div className="intro-section-heading"><p className="intro-kicker">WHY STUDYVERSE</p><h2>続けられる理由を、<br /><em>ひとつの場所に。</em></h2><p>ただ問題を解くだけではなく、学習の手応えと次の一歩が見える設計です。</p></div><div className="intro-feature-grid">{features.map(({ icon: Icon, color, title, text }) => <article key={title} className={`intro-feature-card ${color}`}><span className="intro-feature-icon"><Icon className="h-6 w-6" /></span><h3>{title}</h3><p>{text}</p><a href="#how-it-works">詳しく見る <ArrowRight className="h-4 w-4" /></a></article>)}</div></section>

      <section id="how-it-works" className="intro-section intro-how"><div className="intro-how-visual"><div className="intro-card-stack"><div className="intro-swipe-card back"><small>MEANING</small><strong>維持する</strong></div><div className="intro-swipe-card front"><span className="intro-swipe-label">GREAT</span><small>WORD</small><strong>sustain</strong><p>スワイプして次へ</p><div className="intro-swipe-arrows"><span>←</span><span>↑</span><span>↓</span><span>→</span></div></div></div></div><div className="intro-how-copy"><p className="intro-kicker">HOW IT WORKS</p><h2>迷わない。<br /><em>指で答えるだけ。</em></h2><p>カードを見て、分かった方向へスワイプ。学習中の判断をそのまま記録するから、復習すべき単語が自然に集まります。</p><div className="intro-steps">{steps.map(([number, title, text]) => <div key={number} className="intro-step"><b>{number}</b><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></div></section>

      <section id="classroom" className="intro-section intro-classroom"><div><p className="intro-kicker">FOR CLASSROOMS</p><h2>先生にも、学習者にも。<br /><em>教室の学びをひとつに。</em></h2><p>教材の配布、学習状況、ミッション、教室イベントまで。先生は管理画面から、学習者は自分のペースで使えます。</p><a href="/" className="intro-primary">StudyVerseを始める <ArrowRight className="h-5 w-5" /></a></div><div className="intro-classroom-panel"><div className="intro-panel-top"><span>CLASSROOM OVERVIEW</span><span className="intro-live">● LIVE</span></div><div className="intro-panel-number"><strong>24</strong><span>名が今日ログイン</span></div><div className="intro-bars"><i style={{ height: "58%" }} /><i style={{ height: "78%" }} /><i style={{ height: "48%" }} /><i style={{ height: "91%" }} /><i style={{ height: "70%" }} /><i style={{ height: "84%" }} /><i style={{ height: "96%" }} /></div><div className="intro-panel-legend"><span><i /> 学習時間</span><span>今週のクラス推移</span></div></div></section>

      <section className="intro-final-cta"><div><span className="intro-logo-mark"><Sparkles className="h-5 w-5" /></span><p className="intro-kicker">START YOUR STUDYVERSE</p><h2>今日の数分を、<br /><em>明日の自信に。</em></h2><p>あなたの学びの軌道を、今日からつくろう。</p><a href="/" className="intro-primary">無料で始める <ArrowRight className="h-5 w-5" /></a></div></section>
      <footer className="intro-footer"><a href="/about" className="intro-logo"><span className="intro-logo-mark"><Sparkles className="h-4 w-4" /></span><span>StudyVerse</span></a><span>自分のペースで学びを続ける学習空間</span><a href="/">アプリへ戻る <ArrowRight className="h-4 w-4" /></a></footer>
    </main>
  );
}
