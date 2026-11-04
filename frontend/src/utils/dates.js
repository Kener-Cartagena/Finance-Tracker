import dayjs from 'dayjs'

const ISO = 'YYYY-MM-DD'
export const toISO = (d) => dayjs(d).format(ISO)
export const todayISO = () => dayjs().format(ISO)

export const DATE_PRESETS = [
  { key: 'quincena',   label: 'Esta quincena' },
  { key: 'month',      label: 'Este mes' },
  { key: 'last_month', label: 'Mes pasado' },
  { key: 'last_30',    label: 'Últimos 30 días' },
  { key: 'year',       label: 'Este año' },
  { key: 'all',        label: 'Todo' },
  { key: 'custom',     label: 'Personalizado' },
]

/** { date_from, date_to } for a preset key ('' = no limit). */
export function presetRange(key) {
  const t = dayjs()
  switch (key) {
    case 'quincena':
      return t.date() <= 15
        ? { date_from: toISO(t.startOf('month')), date_to: toISO(t.date(15)) }
        : { date_from: toISO(t.date(16)), date_to: toISO(t.endOf('month')) }
    case 'month':
      return { date_from: toISO(t.startOf('month')), date_to: toISO(t.endOf('month')) }
    case 'last_month': {
      const m = t.subtract(1, 'month')
      return { date_from: toISO(m.startOf('month')), date_to: toISO(m.endOf('month')) }
    }
    case 'last_30':
      return { date_from: toISO(t.subtract(29, 'day')), date_to: toISO(t) }
    case 'year':
      return { date_from: toISO(t.startOf('year')), date_to: toISO(t.endOf('year')) }
    default:
      return { date_from: '', date_to: '' }
  }
}

export function describeRange({ date_from, date_to }) {
  if (!date_from && !date_to) return 'Todo el historial'
  if (date_from && date_to) return `${dayjs(date_from).format('D MMM YYYY')} – ${dayjs(date_to).format('D MMM YYYY')}`
  if (date_from) return `Desde ${dayjs(date_from).format('D MMM YYYY')}`
  return `Hasta ${dayjs(date_to).format('D MMM YYYY')}`
}
