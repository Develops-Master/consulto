// Exportación iCalendar sin nombres, notas clínicas ni enlaces privados.
const Calendario = {
  fechaValida(f) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f || '')) return false;
    const d = new Date(f + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
  },
  horaValida(h) {
    if (!h) return true;
    if (!/^\d{2}:\d{2}$/.test(h)) return false;
    const [hora, minuto] = h.split(':').map(Number);
    return hora < 24 && minuto < 60;
  },
  seleccionar(sesiones, desde, hasta) {
    if (!this.fechaValida(desde) || !this.fechaValida(hasta) || desde > hasta) return [];
    return sesiones.filter(s => s.estado === 'Programada' && this.fechaValida(s.fecha) && this.horaValida(s.hora) && s.fecha >= desde && s.fecha <= hasta)
      .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
  },
  fechaIcs(f, hora, minutos = 0) {
    const [y, m, d] = f.split('-').map(Number), [h, min] = hora.split(':').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d, h + 5, min + minutos));
    return utc.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  },
  fechaDia(f, delta) {
    const [y, m, d] = f.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10).replace(/-/g, '');
  },
  generar(sesiones, desde, hasta, alarma = 0) {
    const eventos = this.seleccionar(sesiones, desde, hasta);
    if (!eventos.length) return '';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Consultorio ERP//Agenda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const s of eventos) {
      const uid = String(s.id || '').replace(/[^a-z0-9-]/gi, '') || crypto.randomUUID();
      lineas.push('BEGIN:VEVENT', `UID:${uid}@consultorio-erp.local`, `DTSTAMP:${stamp}`);
      if (/^\d{2}:\d{2}$/.test(s.hora || '')) {
        const [h, m] = s.hora.split(':').map(Number);
        const dur = Math.max(5, Math.min(720, Number(s.dur) || 45));
        lineas.push(`DTSTART:${this.fechaIcs(s.fecha, s.hora)}`, `DTEND:${this.fechaIcs(s.fecha, s.hora, dur)}`);
        if ([15, 30, 60].includes(Number(alarma))) lineas.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Cita de consultorio', `TRIGGER:-PT${Number(alarma)}M`, 'END:VALARM');
      } else {
        lineas.push(`DTSTART;VALUE=DATE:${s.fecha.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${this.fechaDia(s.fecha, 1)}`);
      }
      lineas.push('SUMMARY:Cita de consultorio', 'STATUS:CONFIRMED', 'END:VEVENT');
    }
    lineas.push('END:VCALENDAR');
    return lineas.join('\r\n') + '\r\n';
  }
};
if (typeof module !== 'undefined') module.exports = Calendario;