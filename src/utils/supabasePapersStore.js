const SUPABASE_URL = 'https://pnmoeodcnjxmsfwmtdso.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubW9lb2Rjbmp4bXNmd210ZHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTE2OTcsImV4cCI6MjA5ODU4NzY5N30.cnnNTtxbq_SWu-K0oBdpLPoS-WKhCD3CHux-ZWxzZD4';

const supabaseFetch = async (query) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) return [];
  return await response.json();
};

export const loadSupabasePapers = async (accessWindow) => {
  try {
    if (!accessWindow) return [];
    const { start, end } = accessWindow;
    const data = await supabaseFetch(
      `examsarkar_papers?select=*&paper_date=gte.${start}&paper_date=lte.${end}&status=eq.ready&order=paper_date.asc,paper_type.asc`
    );
    if (!Array.isArray(data)) return [];
    return data.map(paper => ({
      id: paper.id,
      testName: `${paper.paper_type} — ${paper.paper_date}`,
      title: `${paper.paper_type} — ${paper.paper_date}`,
      type: paper.section === 'Prelims' ? 'prelims' : 'mains',
      subject: paper.paper_type,
      access: 'premium',
      date: paper.paper_date,
      paper_date: paper.paper_date,
      paper_type: paper.paper_type,
      section: paper.section,
      content: paper.content,
      notes_content: paper.notes_content,
      month: paper.month,
      year: paper.year,
      status: paper.status,
      source: 'supabase'
    }));
  } catch (error) {
    console.error('Failed to load Supabase papers:', error);
    return [];
  }
};

export const getSupabasePaperById = async (paperId) => {
  try {
    const data = await supabaseFetch(
      `examsarkar_papers?select=*&id=eq.${paperId}`
    );
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0];
  } catch (error) {
    console.error('Failed to fetch paper:', error);
    return null;
  }
};
