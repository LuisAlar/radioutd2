export default function newCentralTimezoneDate () {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'US/Central' }))
}
