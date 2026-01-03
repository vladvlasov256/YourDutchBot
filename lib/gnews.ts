const GNEWS_API_URL = 'https://gnews.io/api/v4/search';

export interface NewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

interface GNewsResponse {
  totalArticles: number;
  articles: NewsArticle[];
}

export async function fetchNews(query: string, max: number = 10): Promise<NewsArticle[]> {
  const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

  if (!GNEWS_API_KEY) {
    console.error('GNEWS_API_KEY is not set');
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      lang: 'en',
      max: max.toString(),
      apikey: GNEWS_API_KEY,
    });

    const url = `${GNEWS_API_URL}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        console.error('GNews API error: 429 Too Many Requests - rate limit exceeded');
      } else {
        console.error('GNews API error:', response.status, response.statusText);
      }
      return [];
    }

    const data = await response.json() as GNewsResponse;
    return data.articles || [];
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}

export async function getRandomArticle(query: string): Promise<NewsArticle | null> {
  const articles = await fetchNews(query, 10);

  if (articles.length === 0) {
    return null;
  }

  // Pick a random article
  const randomIndex = Math.floor(Math.random() * articles.length);
  return articles[randomIndex];
}
