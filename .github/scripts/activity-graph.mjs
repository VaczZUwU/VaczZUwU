import { mkdir, writeFile } from 'node:fs/promises';

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${process.env.GH_TOKEN}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    query: `query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }`,
    variables: { login: process.env.PROFILE_LOGIN },
  }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL returned HTTP ${response.status}`);
}

const { data, errors } = await response.json();
const weeks = data?.user?.contributionsCollection?.contributionCalendar?.weeks;
if (errors?.length || !weeks?.length) {
  throw new Error('GitHub did not return the contribution calendar');
}

const days = weeks.flatMap(({ contributionDays }) => contributionDays).slice(-30);
const counts = days.map(({ contributionCount }) => contributionCount);
const total = counts.reduce((sum, count) => sum + count, 0);
const peak = Math.max(1, ...counts);
const points = counts.map((count, index) => {
  const x = 28 + (824 * index) / Math.max(1, counts.length - 1);
  const y = 136 - (79 * count) / peak;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
});
const [lastX, lastY] = points.at(-1).split(',');
const dateFormat = new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
});
const dateLabel = (day) => dateFormat.format(new Date(day.date));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="176" viewBox="0 0 880 176" role="img">
  <title>GitHub activity over the last 30 days</title>
  <desc>${total} contributions from ${days[0].date} to ${days.at(-1).date}</desc>
  <rect x="1" y="1" width="878" height="174" rx="12" fill="#09121c" stroke="#182b3b"/>
  <path d="M28 57H852 M28 96.5H852 M28 136H852" stroke="#182b3b"/>
  <polygon points="28,136 ${points.join(' ')} ${lastX},136" fill="#122c3c"/>
  <polyline points="${points.join(' ')}" fill="none" stroke="#1793d1" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="${lastX}" cy="${lastY}" r="3.5" fill="#75dce7"/>
  <g font-family="ui-monospace, monospace">
    <text x="28" y="32" fill="#75dce7" font-size="16">GitHub activity</text>
    <text x="852" y="32" fill="#8da5b6" font-size="14" text-anchor="end">${total} contributions / ${days.length} days</text>
    <text x="28" y="158" fill="#8da5b6" font-size="13">${dateLabel(days[0])}</text>
    <text x="852" y="158" fill="#8da5b6" font-size="13" text-anchor="end">${dateLabel(days.at(-1))}</text>
  </g>
</svg>
`;

await mkdir('dist', { recursive: true });
await writeFile('dist/activity.svg', svg);
