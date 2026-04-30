import React, { useState, useEffect } from 'react';
import WordStudy from './WordStudy';

const BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah',
  'Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
  '2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
];

const CHAPTER_COUNTS = {
  'Genesis':50,'Exodus':40,'Leviticus':27,'Numbers':36,'Deuteronomy':34,'Joshua':24,
  'Judges':21,'Ruth':4,'1 Samuel':31,'2 Samuel':24,'1 Kings':22,'2 Kings':25,
  '1 Chronicles':29,'2 Chronicles':36,'Ezra':10,'Nehemiah':13,'Esther':10,'Job':42,
  'Psalms':150,'Proverbs':31,'Ecclesiastes':12,'Song of Solomon':8,'Isaiah':66,
  'Jeremiah':52,'Lamentations':5,'Ezekiel':48,'Daniel':12,'Hosea':14,'Joel':3,
  'Amos':9,'Obadiah':1,'Jonah':4,'Micah':7,'Nahum':3,'Habakkuk':3,'Zephaniah':3,
  'Haggai':2,'Zechariah':14,'Malachi':4,'Matthew':28,'Mark':16,'Luke':24,'John':21,
  'Acts':28,'Romans':16,'1 Corinthians':16,'2 Corinthians':13,'Galatians':6,
  'Ephesians':6,'Philippians':4,'Colossians':4,'1 Thessalonians':5,'2 Thessalonians':3,
  '1 Timothy':6,'2 Timothy':4,'Titus':3,'Philemon':1,'Hebrews':13,'James':5,
  '1 Peter':5,'2 Peter':3,'1 John':5,'2 John':1,'3 John':1,'Jude':1,'Revelation':22,
};

// AO Lab book ID map (subset — major books)
const BOOK_ID = {
  'Genesis':'GEN','Exodus':'EXO','Leviticus':'LEV','Numbers':'NUM','Deuteronomy':'DEU',
  'Joshua':'JOS','Judges':'JDG','Ruth':'RUT','1 Samuel':'1SA','2 Samuel':'2SA',
  '1 Kings':'1KI','2 Kings':'2KI','1 Chronicles':'1CH','2 Chronicles':'2CH',
  'Ezra':'EZR','Nehemiah':'NEH','Esther':'EST','Job':'JOB','Psalms':'PSA',
  'Proverbs':'PRO','Ecclesiastes':'ECC','Song of Solomon':'SNG','Isaiah':'ISA',
  'Jeremiah':'JER','Lamentations':'LAM','Ezekiel':'EZK','Daniel':'DAN','Hosea':'HOS',
  'Joel':'JOL','Amos':'AMO','Obadiah':'OBA','Jonah':'JON','Micah':'MIC','Nahum':'NAH',
  'Habakkuk':'HAB','Zephaniah':'ZEP','Haggai':'HAG','Zechariah':'ZEC','Malachi':'MAL',
  'Matthew':'MAT','Mark':'MRK','Luke':'LUK','John':'JHN','Acts':'ACT','Romans':'ROM',
  '1 Corinthians':'1CO','2 Corinthians':'2CO','Galatians':'GAL','Ephesians':'EPH',
  'Philippians':'PHP','Colossians':'COL','1 Thessalonians':'1TH','2 Thessalonians':'2TH',
  '1 Timothy':'1TI','2 Timothy':'2TI','Titus':'TIT','Philemon':'PHM','Hebrews':'HEB',
  'James':'JAS','1 Peter':'1PE','2 Peter':'2PE','1 John':'1JN','2 John':'2JN',
  '3 John':'3JN','Jude':'JUD','Revelation':'REV',
};

const AO = 'https://bible.helloao.org/api';

async function fetchShepherdChapter(book, chapter) {
  // Shepherd (simplecohortllc) is unreliable — use AO Lab for chapter data
  // Returns null so chapter summary/groupings are skipped gracefully
  return null;
}

async function fetchVotd(translation) {
  const r = await fetch('/api/verse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ translation, random: true }),
  });
  return r.json();
}

async function fetchAOChapter(book, chapter, translation = 'BSB') {
  const id = BOOK_ID[book];
  if (!id) return null;
  try {
    const r = await fetch(`${AO}/${translation}/${id}/${chapter}.json`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function fetchCommentary(book, chapter) {
  const id = BOOK_ID[book];
  if (!id) return null;
  try {
    const r = await fetch(`${AO}/c/adam-clarke/${id}/${chapter}.json`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function fetchCrossRefs(book, chapter) {
  const id = BOOK_ID[book];
  if (!id) return null;
  try {
    const r = await fetch(`${AO}/d/open-cross-ref/${id}/${chapter}.json`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function searchVerses(query) {
  try {
    const r = await fetch(`${SHEPHERD}/search?q=${encodeURIComponent(query)}&translation=KJV`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

export default function ScriptureTab({ translation, onAskBuddy }) {
  const [votd, setVotd] = useState(null);
  const [votdLoading, setVotdLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Chapter browser
  const [book, setBook] = useState('John');
  const [chapter, setChapter] = useState(3);
  const [chapterData, setChapterData] = useState(null);
  const [shepherdData, setShepherdData] = useState(null);
  const [commentary, setCommentary] = useState(null);
  const [crossRefs, setCrossRefs] = useState(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const [expandedCrossRef, setExpandedCrossRef] = useState(null);
  const [wordStudy, setWordStudy] = useState(null); // {reference, text}

  useEffect(() => {
    fetchVotd(translation)
      .then(d => setVotd(d))
      .finally(() => setVotdLoading(false));
  }, [translation]);

  const loadChapter = async () => {
    setChapterLoading(true);
    setChapterData(null);
    setShepherdData(null);
    setCommentary(null);
    setCrossRefs(null);
    setShowCommentary(false);
    setExpandedCrossRef(null);

    const [ao, shepherd, clarke, refs] = await Promise.all([
      fetchAOChapter(book, chapter),
      fetchShepherdChapter(book, chapter),
      fetchCommentary(book, chapter),
      fetchCrossRefs(book, chapter),
    ]);

    setChapterData(ao);
    setShepherdData(shepherd?.data || null);
    setCommentary(clarke);
    setCrossRefs(refs);
    setChapterLoading(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults(null);
    const data = await searchVerses(searchQuery.trim());
    setSearchResults(data?.data || []);
    setSearchLoading(false);
  };

  const chapCount = CHAPTER_COUNTS[book] || 50;

  // Build verse → cross-refs map
  const crossRefMap = {};
  if (crossRefs?.verses) {
    crossRefs.verses.forEach(v => {
      if (v.crossReferences?.length) crossRefMap[v.verse] = v.crossReferences;
    });
  }

  // Build verse → section title map from Shepherd groupings
  const sectionMap = {};
  if (shepherdData?.groupings?.groups) {
    shepherdData.groupings.groups.forEach(g => {
      if (g.verses?.length) sectionMap[g.verses[0]] = g.title;
    });
  }

  return (
    <div className="scripture-tab">

      {/* Verse of the Day */}
      <section className="votd-card">
        <span className="section-label">VERSE OF THE DAY · {translation}</span>
        {votdLoading
          ? <div className="typing-dots" style={{ marginTop: 8 }}><span /><span /><span /></div>
          : votd && !votd.error
            ? <>
                <p className="votd-text">"{votd.text}"</p>
                <div className="votd-footer">
                  <p className="votd-ref">— {votd.reference}</p>
                  {onAskBuddy && (
                    <button className="ask-buddy-btn" onClick={() => onAskBuddy(`Explain ${votd.reference}: "${votd.text}"`)}>
                      Ask Bible Buddy ✨
                    </button>
                  )}
                </div>
              </>
            : <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Could not load verse.</p>
        }
      </section>

      {/* Keyword Search */}
      <section className="scripture-section">
        <span className="section-label">SEARCH SCRIPTURE</span>
        <form className="lookup-row" onSubmit={handleSearch}>
          <input
            className="scripture-input"
            placeholder="Search by keyword, topic, or phrase…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button className="scripture-btn" type="submit" disabled={searchLoading}>
            {searchLoading ? '…' : 'Search'}
          </button>
        </form>
        {searchResults && (
          <div className="search-results">
            {searchResults.length === 0
              ? <p className="scripture-muted">No results found.</p>
              : searchResults.slice(0, 12).map((v, i) => (
                  <div key={i} className="search-result-item">
                    <div className="search-result-header">
                      <span className="verse-result-ref">{v.book} {v.chapter}:{v.verse}</span>
                      {onAskBuddy && (
                        <button className="ask-buddy-inline" onClick={() => onAskBuddy(`Explain ${v.book} ${v.chapter}:${v.verse} — "${v.text}"`)}>
                          Ask ✨
                        </button>
                      )}
                    </div>
                    <p className="verse-result-text">{v.text}</p>
                  </div>
                ))
            }
          </div>
        )}
      </section>

      {/* Chapter Browser */}
      <section className="scripture-section">
        <span className="section-label">CHAPTER BROWSER</span>
        <div className="browser-controls">
          <select className="scripture-select" value={book}
            onChange={e => { setBook(e.target.value); setChapter(1); setChapterData(null); }}>
            {BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="scripture-select scripture-select-sm" value={chapter}
            onChange={e => { setChapter(Number(e.target.value)); setChapterData(null); }}>
            {Array.from({ length: chapCount }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button className="scripture-btn" onClick={loadChapter} disabled={chapterLoading}>
            {chapterLoading ? '…' : 'Read'}
          </button>
        </div>

        {chapterLoading && (
          <div className="typing-dots" style={{ marginTop: 16 }}><span /><span /><span /></div>
        )}

        {shepherdData?.groupings?.summary && (
          <div className="chapter-summary">
            <span className="section-label" style={{ marginBottom: 4 }}>CHAPTER SUMMARY</span>
            <p className="chapter-summary-text">{shepherdData.groupings.summary}</p>
          </div>
        )}

        {chapterData?.verses && (
          <div className="chapter-text">
            <div className="chapter-title-row">
              <p className="verse-result-ref">{book} {chapter} <span className="verse-translation">({translation})</span></p>
              {onAskBuddy && (
                <button className="ask-buddy-inline" onClick={() => onAskBuddy(`Give me a deep commentary on ${book} chapter ${chapter}`)}>
                  Ask Bible Buddy ✨
                </button>
              )}
            </div>

            {chapterData.verses.map((v, i) => (
              <div key={i} className="verse-row">
                {sectionMap[v.verse] && (
                  <p className="section-title">{sectionMap[v.verse]}</p>
                )}
                <div className="verse-line">
                  <span className="verse-num">{v.verse}</span>
                  <span className="verse-text">{v.text}</span>
                  <button
                    className="cross-ref-btn"
                    onClick={() => setWordStudy({ reference: `${book} ${chapter}:${v.verse}`, text: v.text })}
                    title="Word study"
                  >αβ</button>
                  {crossRefMap[v.verse] && (
                    <button
                      className="cross-ref-btn"
                      onClick={() => setExpandedCrossRef(expandedCrossRef === v.verse ? null : v.verse)}
                      title="Cross-references"
                    >
                      ⇄
                    </button>
                  )}
                </div>
                {expandedCrossRef === v.verse && crossRefMap[v.verse] && (
                  <div className="cross-ref-list">
                    <span className="section-label" style={{ fontSize: 9 }}>CROSS-REFERENCES</span>
                    {crossRefMap[v.verse].slice(0, 6).map((ref, j) => (
                      <span key={j} className="cross-ref-tag"
                        onClick={() => onAskBuddy && onAskBuddy(`Explain ${ref.book} ${ref.chapter}:${ref.verse} and how it relates to ${book} ${chapter}:${v.verse}`)}>
                        {ref.book} {ref.chapter}:{ref.verse}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {commentary && (
              <div className="commentary-section">
                <button className="commentary-toggle" onClick={() => setShowCommentary(p => !p)}>
                  {showCommentary ? '▲' : '▼'} Adam Clarke Commentary
                </button>
                {showCommentary && commentary.verses && (
                  <div className="commentary-body">
                    {commentary.verses.slice(0, 8).map((v, i) => v.commentary && (
                      <div key={i} className="commentary-verse">
                        <span className="commentary-ref">Verse {v.verse}</span>
                        <p className="commentary-text">{v.commentary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Word Study panel */}
      {wordStudy && (
        <WordStudy
          reference={wordStudy.reference}
          verseText={wordStudy.text}
          translation={translation}
          onClose={() => setWordStudy(null)}
        />
      )}
    </div>
  );
}
