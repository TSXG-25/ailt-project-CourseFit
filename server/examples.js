const slot = (day, start, end) => ({ day, start, end });
const section = (id, ...meetings) => ({ id, meetings });
const course = (id, name, ...sections) => ({ id, name, sections });

export const EXAMPLES = [
  {
    id: 'balanced-week', name: 'A little more breathing room',
    description: 'Four courses, a later start and a Friday to yourself.',
    input: `COMP2119 Data Structures
  A: Mon 10:00–12:00 and Wed 10:00–11:00
  B: Tue 14:00–16:00 and Thu 14:00–15:00
MATH1853 Linear Algebra
  A: Mon 13:00–15:00
  B: Fri 09:00–11:00
STAT2601 Probability
  A: Tue 10:00–12:00
  B: Wed 13:00–15:00
AILT9019 AI Literacy II
  A: Thu 10:00–12:00
  B: Fri 14:00–16:00

I cannot attend classes before 10:00.
I would prefer Friday off.
If possible, keep gaps between classes to at most 90 minutes.`,
    data: {
      courses: [
        course('COMP2119', 'Data Structures', section('A', slot('Mon', '10:00', '12:00'), slot('Wed', '10:00', '11:00')), section('B', slot('Tue', '14:00', '16:00'), slot('Thu', '14:00', '15:00'))),
        course('MATH1853', 'Linear Algebra', section('A', slot('Mon', '13:00', '15:00')), section('B', slot('Fri', '09:00', '11:00'))),
        course('STAT2601', 'Probability', section('A', slot('Tue', '10:00', '12:00')), section('B', slot('Wed', '13:00', '15:00'))),
        course('AILT9019', 'AI Literacy II', section('A', slot('Thu', '10:00', '12:00')), section('B', slot('Fri', '14:00', '16:00'))),
      ],
      hardConstraints: [{ type: 'earliest_start', time: '10:00' }],
      softPreferences: [{ type: 'day_off', day: 'Fri' }, { type: 'max_gap', minutes: 90 }], clarifications: [],
    },
  },
  {
    id: 'unavoidable-clash', name: 'When the pieces cannot fit',
    description: 'Two compulsory sections overlap. See how CourseFit handles it.',
    input: `COMP2119 Data Structures: section A, Mon 10:00–12:00.
MATH1853 Linear Algebra: section A, Mon 11:00–13:00.
These are the only available sections. I would prefer Friday free.`,
    data: {
      courses: [course('COMP2119', 'Data Structures', section('A', slot('Mon', '10:00', '12:00'))), course('MATH1853', 'Linear Algebra', section('A', slot('Mon', '11:00', '13:00')))],
      hardConstraints: [], softPreferences: [{ type: 'day_off', day: 'Fri' }], clarifications: [],
    },
  },
  {
    id: 'needs-clarification', name: 'A preference worth checking',
    description: '“Avoid morning classes” needs a time boundary, not a guess.',
    input: `ECON1210 Introductory Microeconomics
  A: Tue 09:00–11:00
  B: Thu 14:00–16:00
I would rather avoid morning classes if possible.`,
    data: {
      courses: [course('ECON1210', 'Introductory Microeconomics', section('A', slot('Tue', '09:00', '11:00')), section('B', slot('Thu', '14:00', '16:00')))],
      hardConstraints: [], softPreferences: [],
      clarifications: ['“Avoid morning classes if possible” is a soft preference. What is the earliest start you prefer?'],
    },
  },
];
