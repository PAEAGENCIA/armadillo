/*
 * Documentos legales de Redeo.
 * Un solo lugar para el texto: la página los muestra y el mismo archivo sirve para generar el Word
 * que revisa el abogado. Los datos (P.A.E. y cada negocio) se llenan solos; lo que falte se ve
 * resaltado como [[Por completar]] para que nunca se publique un hueco sin darnos cuenta.
 *
 * Base legal revisada: Ley Federal de Protección de Datos Personales en Posesión de los Particulares
 * (DOF 20-03-2025, última reforma 14-11-2025), Código de Comercio, Código Civil Federal y Ley Federal
 * de Protección al Consumidor. IMPORTANTE: son modelos para revisión de un abogado; no son asesoría legal.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-09-28';
  var UPDATED = '28 de septiembre de 2026';

  // ---------- utilidades ----------
  function clean(v) { return v == null ? '' : String(v).replace(/\[\[|\]\]|\*\*/g, '').trim(); }
  function val(v, label) { var c = clean(v); return c ? c : '[[' + label + ']]'; }
  function has(v) { return clean(v) !== ''; }

  // ctx = { pae:{name,brand,address,email,phone,rfc,site}, biz:{name,legalName,address,email,mechanic,stampsGoal,pointsGoal,pointsPerVisit,rewardDesc} }
  function norm(ctx) {
    ctx = ctx || {};
    var p = ctx.pae || {}, b = ctx.biz || {};
    var P = {
      name: val(p.name, 'Nombre completo del titular de P.A.E.'),
      brand: clean(p.brand) || 'P.A.E.',
      address: val(p.address, 'Domicilio de P.A.E.'),
      email: val(p.email, 'Correo de contacto de P.A.E.'),
      phone: val(p.phone, 'WhatsApp de P.A.E.'),
      rfc: clean(p.rfc),
      site: clean(p.site) || 'la plataforma Redeo'
    };
    var B = {
      name: val(b.name, 'Nombre comercial del negocio'),
      legalName: val(b.legalName, 'Nombre o razón social del negocio'),
      address: val(b.address, 'Domicilio del negocio'),
      email: clean(b.email),
      hasEmail: has(b.email),
      mechanic: b.mechanic === 'puntos' ? 'puntos' : 'sellos',
      goal: b.mechanic === 'puntos' ? Number(b.pointsGoal) || 0 : Number(b.stampsGoal) || 0,
      perVisit: Number(b.pointsPerVisit) || 0,
      reward: val(b.rewardDesc, 'Premio del programa')
    };
    // Cómo pedir algo al negocio (por correo si lo registró; siempre en persona en el local).
    B.contact = B.hasEmail
      ? 'escribiendo a ' + B.email + ' o en persona en el establecimiento'
      : 'en persona en el establecimiento';
    return { P: P, B: B };
  }

  function h(x) { return { t: 'h', x: x }; }
  function p(x) { return { t: 'p', x: x }; }
  function ul(items) { return { t: 'ul', items: items }; }
  function box(title, items) { return { t: 'box', title: title, items: items }; }
  function small(x) { return { t: 'small', x: x }; }

  // =====================================================================
  // 1) TÉRMINOS Y CONDICIONES DEL SERVICIO (contrato con el negocio)
  // =====================================================================
  function terminos(ctx) {
    var n = norm(ctx), P = n.P;
    return {
      id: 'terminos',
      kicker: 'Contrato para negocios',
      title: 'Términos y Condiciones del Servicio Redeo',
      blocks: [
        box('En palabras simples', [
          'Redeo es una herramienta para que tu negocio tenga su tarjeta de lealtad digital. ' + P.brand + ' te da el acceso; tú manejas tu programa.',
          'Pruebas gratis, sin dar tarjeta bancaria y sin cobros automáticos.',
          'Pagas por mes o por año, por adelantado. Si no pagas, tu panel se pausa, pero no se borra nada de inmediato.',
          'Tus clientes son tuyos: puedes descargarlos cuando quieras. Nosotros solo los guardamos por tu encargo y nunca los vendemos.',
          'Tú decides y cumples los premios y promociones que ofreces a tus clientes.',
          'Cuida tus PIN: lo que se haga con ellos cuenta como hecho por tu negocio.',
          'Puedes cancelar cuando quieras, sin penalización.'
        ]),
        small('Este resumen ayuda a entender el contrato, pero no lo sustituye. Lo que vale es el texto completo.'),

        h('1. Partes y aceptación'),
        p('1.1 Estos Términos y Condiciones (los **"Términos"**) son un contrato entre ' + P.name + ', persona que opera con el nombre comercial ' + P.brand + ' (**"' + P.brand + '"** o **"nosotros"**), con domicilio en ' + P.address + (P.rfc ? ' y RFC ' + P.rfc : '') + ', y la persona física o moral que da de alta un negocio en Redeo (el **"Negocio"** o **"tú"**).'),
        p('1.2 Aceptas estos Términos cuando marcas la casilla de aceptación en la plataforma, cuando los firmas o cuando usas el Servicio. La aceptación por medios electrónicos tiene la misma validez que una firma autógrafa, conforme al Código de Comercio y al Código Civil Federal. Guardamos constancia de la fecha, hora, versión aceptada y nombre de quien aceptó.'),
        p('1.3 Quien acepta a nombre del Negocio declara que tiene facultades para obligarlo. Si no las tiene, se obliga personalmente.'),
        p('1.4 Si firmaste una cotización o propuesta con ' + P.brand + ', forma parte de estos Términos. Si hay diferencias en precio, plan o vigencia, se aplica la cotización.'),

        h('2. Definiciones'),
        ul([
          '**Servicio** o **Redeo**: la plataforma web de tarjetas de lealtad digitales, con su panel, ligas, códigos QR y demás funciones del plan contratado.',
          '**Panel**: el área privada del Negocio, a la que se entra con su código y un PIN.',
          '**PIN del dueño**: da acceso completo al Panel. **PIN del personal**: permite atender clientes en caja, con permisos limitados.',
          '**Clientes Finales**: las personas que se inscriben al programa de lealtad del Negocio.',
          '**Datos de Clientes**: los datos personales de los Clientes Finales que se guardan en Redeo.',
          '**Programa**: el programa de lealtad del Negocio: su premio, meta, sellos o puntos, reglas y promociones.',
          '**Plan**: Esencial o Premium, con las funciones descritas en el catálogo o cotización vigente.',
          '**Periodo**: el tiempo de acceso pagado (mensual o anual) o de prueba.'
        ]),

        h('3. Qué incluye el Servicio'),
        p('3.1 ' + P.brand + ' otorga al Negocio una licencia de uso no exclusiva, intransferible y limitada al Periodo pagado para usar el Servicio en sus establecimientos en México. No es una venta del software.'),
        p('3.2 Las funciones de cada Plan son las del catálogo o cotización vigente. Podemos mejorar, cambiar o retirar funciones siempre que el Servicio conserve lo esencial del Plan contratado. Si retiramos una función principal de tu Plan durante un Periodo ya pagado, puedes cancelar y te devolvemos la parte proporcional no usada.'),
        p('3.3 Las funciones anunciadas o en desarrollo (por ejemplo, agregar la tarjeta a Apple Wallet o Google Wallet) no forman parte del Servicio hasta que aparezcan disponibles en tu Panel.'),
        p('3.4 Salvo que se contrate aparte por escrito, el Servicio no incluye: envío masivo de mensajes, publicidad pagada, diseño gráfico, impresión de materiales, equipo de cómputo, conexión a internet ni asesoría legal, fiscal o contable.'),

        h('4. Tu cuenta y tus PIN'),
        p('4.1 Al dar de alta tu negocio recibes un código y un PIN del dueño. Puedes crear un PIN del personal para quien atiende en caja.'),
        p('4.2 Eres responsable de mantener tus PIN en secreto, de decidir a quién se los das y de cambiarlos cuando alguien deje de trabajar contigo. Todo lo que se haga en el Panel con tus PIN se considera hecho por el Negocio.'),
        p('4.3 Si crees que alguien conoce tu PIN sin permiso, cámbialo de inmediato desde Ajustes y avísanos. Podemos restablecer tu PIN después de verificar tu identidad.'),
        p('4.4 Debes darnos información verdadera y mantener actualizados tus datos de contacto y los datos legales de tu negocio que aparecen en el aviso de privacidad de tus clientes.'),
        p('4.5 Cada alta corresponde a una marca. Las sucursales de la misma marca pueden usar el mismo Panel; marcas distintas requieren altas distintas.'),

        h('5. Prueba gratis'),
        p('5.1 ' + P.brand + ' puede darte un periodo de prueba, normalmente de 14 días naturales. Durante la prueba no pedimos datos de tarjeta bancaria ni hacemos cargos automáticos.'),
        p('5.2 Si la prueba termina sin pago, el Panel se pausa: no se pueden registrar visitas ni cambiar ajustes, pero puedes entrar a ver y descargar tus clientes. Tus Clientes Finales pueden seguir consultando su tarjeta y pedir la suya. No se borra nada en ese momento (ver cláusula 7).'),
        p('5.3 La prueba se ofrece tal cual, sin compromisos de nivel de servicio. ' + P.brand + ' decide si la ofrece y por cuánto tiempo.'),

        h('6. Precios y pagos'),
        p('6.1 El Plan y Periodo elegidos (mensual o anual) se pagan por adelantado, al precio de tu cotización o del catálogo vigente al momento del pago. El plan anual equivale al precio de diez meses, salvo que la cotización diga otra cosa.'),
        p('6.2 Los precios están en pesos mexicanos. Salvo que la cotización diga que ya lo incluyen, no incluyen el Impuesto al Valor Agregado, que se agregará cuando proceda. Si necesitas factura (CFDI), pídela con tus datos fiscales dentro del mes en que pagaste.'),
        p('6.3 Puedes pagar por transferencia, depósito, efectivo u otras formas que aceptemos. ' + P.brand + ' no recibe ni guarda números de tarjetas bancarias. Cada pago registrado tiene un recibo con folio.'),
        p('6.4 Cada pago extiende tu acceso por los meses pagados, contados desde el día siguiente al vencimiento anterior o, si ya estaba vencido, desde el día del pago.'),
        p('6.5 Si cambian los precios, te avisaremos con al menos 30 días naturales de anticipación. El nuevo precio se aplica a partir de tu siguiente Periodo; lo que ya pagaste no cambia.'),
        p('6.6 Puedes subir de Plan en cualquier momento pagando la diferencia proporcional. Si bajas de Plan, el cambio se aplica desde tu siguiente Periodo; las funciones Premium dejan de estar disponibles y el diseño de la tarjeta se ajusta a lo que permite el plan Esencial, sin borrar tus datos.'),
        p('6.7 Los Periodos pagados no son reembolsables, ni total ni parcialmente, salvo en los casos de las cláusulas 3.2, 16.3 inciso c), 18.2 y del Anexo A (cambio de proveedores), en los que se devuelve la parte proporcional no usada.'),

        h('7. Falta de pago'),
        p('7.1 Si no pagas a tiempo, el Panel se pausa a partir del día siguiente al vencimiento, en los términos de la cláusula 5.2. Procuraremos avisarte antes del vencimiento por WhatsApp o correo; la falta de aviso no te libera del pago.'),
        p('7.2 Al pagar, el Panel se reactiva con toda su información.'),
        p('7.3 Si pasan 90 días naturales desde el vencimiento sin pago ni acuerdo contigo, podemos terminar el contrato avisándote con al menos 15 días naturales de anticipación. A partir de la terminación se aplica la cláusula 16.4.'),

        h('8. Obligaciones del Negocio'),
        p('8.1 Usar el Servicio solo para operar un programa de lealtad lícito de su propio negocio.'),
        p('8.2 Ser el único responsable de su Programa frente a sus Clientes Finales: definir y comunicar sus reglas, entregar los premios cuando se cumplan las condiciones, respetar las promociones que active (incluidas las automáticas del plan Premium, como sellos dobles, cumpleaños, bienvenida, invitaciones y temporadas) y cumplir la Ley Federal de Protección al Consumidor y las demás normas sobre promociones y ofertas.'),
        p('8.3 Mantener clara, verdadera y actualizada la información de su Programa en la plataforma (premio, meta, promociones y vigencias).'),
        p('8.4 Cumplir la ley de protección de datos personales como responsable de los Datos de Clientes (cláusula 10). En particular: registrar y mantener al día en Ajustes su nombre o razón social, domicilio y correo de contacto para el aviso de privacidad; poner a disposición de sus clientes el aviso de privacidad antes de registrarlos, incluso cuando los registre en persona desde el Panel (por ejemplo, mostrando el cartel con código QR o enviando la liga); atender a tiempo las solicitudes de sus clientes; y enviar promociones únicamente a quienes las aceptaron.'),
        p('8.5 Los mensajes por WhatsApp (liga de la tarjeta, cumpleaños, "te extrañamos", promociones) se envían desde el teléfono del Negocio y bajo su responsabilidad; Redeo solo prepara el texto y la lista. El Negocio debe respetar las políticas de WhatsApp, el Registro Público para Evitar Publicidad (REPEP) de la PROFECO y a cualquier persona que pida no recibir mensajes.'),
        p('8.6 El Negocio no debe:'),
        ul([
          'registrar a personas sin su conocimiento o con datos falsos;',
          'vender sellos o puntos, o darlos a cambio de dinero;',
          'usar el Servicio para publicidad engañosa, fraudes, sorteos sin permiso de la autoridad, o productos o actividades ilícitas;',
          'subir logos, imágenes o textos que no tenga derecho a usar o que sean ofensivos;',
          'intentar entrar a cuentas ajenas, adivinar PIN, saturar el Servicio, copiar, descompilar o hacer ingeniería inversa del software;',
          'revender o sublicenciar el Servicio sin autorización por escrito de ' + P.brand + ';',
          'inscribir a menores de edad sin el consentimiento de su madre, padre o tutor;',
          'pedir a sus clientes, a través del Servicio, datos personales sensibles (por ejemplo, de salud, religión u origen étnico), ni anotar en favoritos o en otros campos alergias, padecimientos u otros datos de salud.'
        ]),
        p('8.7 Si el Negocio incumple esta cláusula, ' + P.brand + ' puede suspender el Servicio de inmediato cuando haya riesgo para terceros o para la plataforma, avisándole. En los demás casos le daremos 5 días hábiles para corregir.'),

        h('9. El Programa y los Clientes Finales'),
        p('9.1 La relación con los Clientes Finales es exclusivamente entre ellos y el Negocio. ' + P.brand + ' no es parte del Programa, no otorga los premios ni responde por su entrega, calidad o cambios.'),
        p('9.2 Los sellos, puntos y premios no tienen valor monetario, no son dinero electrónico ni medio de pago y no generan saldo a favor frente a ' + P.brand + '.'),
        p('9.3 El Negocio puede usar los Términos del Programa modelo que Redeo publica en la liga de su tarjeta, o sustituirlos por los suyos avisándonos. Los modelos son una base; el Negocio es responsable de revisarlos y de que reflejen sus reglas reales.'),
        p('9.4 Si el Negocio decide terminar su Programa, debe avisar a sus Clientes Finales con al menos 30 días naturales de anticipación y respetar los premios completados, conforme a los Términos del Programa.'),
        p('9.5 Si un Cliente Final nos contacta por un tema del Programa, lo canalizaremos con el Negocio.'),

        h('10. Datos personales'),
        p('10.1 **Datos de los Clientes Finales.** El Negocio es el responsable de esos datos y ' + P.brand + ' es su encargado: los trata solo por cuenta del Negocio y para prestarle el Servicio, conforme al Anexo A, que forma parte de estos Términos.'),
        p('10.2 Redeo genera para el Negocio un Aviso de Privacidad Integral y unos Términos del Programa con los datos que registre en Ajustes. Son modelos: el Negocio debe revisarlos y es responsable de que sean exactos.'),
        p('10.3 **Datos del Negocio y sus contactos.** Respecto de los datos del dueño, representantes y personal que nos da para contratar, cobrar y recibir soporte, ' + P.brand + ' es responsable y los trata conforme a su Aviso de Privacidad para Negocios, publicado en Redeo.'),
        p('10.4 ' + P.brand + ' puede generar estadísticas agregadas y anónimas sobre el uso del Servicio (por ejemplo, promedio de visitas por negocio) para mejorarlo y promoverlo, sin identificar a ninguna persona ni al Negocio.'),

        h('11. Propiedad intelectual'),
        p('11.1 El software, diseño, las marcas "Redeo" y "' + P.brand + '", los textos modelo, plantillas y documentación pertenecen a ' + P.brand + ' o a sus licenciantes. Estos Términos no te transfieren ningún derecho sobre ellos, salvo la licencia de uso de la cláusula 3.'),
        p('11.2 Tu nombre comercial, logo, productos y contenidos siguen siendo tuyos. Nos das permiso de usarlos únicamente para mostrarlos en tu tarjeta, tu Panel, carteles y materiales del Servicio mientras el contrato esté vigente.'),
        p('11.3 Solo mencionaremos a tu negocio como cliente o caso de éxito (en redes sociales, catálogos o presentaciones) si nos das permiso por escrito, que puede ser por WhatsApp. Puedes retirar ese permiso cuando quieras para usos futuros.'),
        p('11.4 Si nos das sugerencias o comentarios, podemos usarlos para mejorar el Servicio sin que eso genere un pago.'),

        h('12. Disponibilidad y soporte'),
        p('12.1 Haremos esfuerzos razonables para que el Servicio esté disponible todos los días, a toda hora, pero no garantizamos que funcione sin interrupciones ni errores. Puede haber pausas por mantenimiento, actualizaciones, fallas de proveedores (hospedaje, internet, telefonía) u otras causas fuera de nuestro control.'),
        p('12.2 Procuraremos hacer los mantenimientos planeados en horarios de poca actividad y avisar con anticipación los que duren más de una hora.'),
        p('12.3 El soporte se da por WhatsApp o correo en días hábiles, de 10:00 a 18:00 horas (hora del centro de México). Procuramos responder el mismo día hábil o el siguiente.'),
        p('12.4 El Servicio funciona en navegadores actualizados y requiere internet. El Negocio debe contar con su equipo, su conexión y una forma alterna de anotar visitas (por ejemplo, en papel) por si el Servicio no está disponible un momento.'),
        p('12.5 El Servicio usa proveedores terceros (hospedaje en la nube, servicios de Google, WhatsApp y, en su caso, Apple o Google Wallet), que se rigen por sus propias condiciones. No respondemos por sus fallas, pero buscaremos soluciones razonables.'),
        p('12.6 Si el Servicio deja de estar disponible por causas atribuibles a ' + P.brand + ' por más de 24 horas continuas, a tu solicitud agregaremos a tu Periodo el doble del tiempo sin servicio. Salvo dolo o negligencia grave, esa es la compensación por la interrupción.'),

        h('13. Respaldos y descarga de información'),
        p('13.1 ' + P.brand + ' hace respaldos periódicos de la información. Aun así, ningún sistema es infalible.'),
        p('13.2 Puedes descargar tu lista de clientes en cualquier momento desde el Panel, incluso cuando está en pausa. Te recomendamos hacerlo al menos una vez al mes.'),
        p('13.3 No respondemos por la pérdida de información causada por el uso de tus PIN, por borrados que hagas tú o tu personal, o por caso fortuito o fuerza mayor.'),

        h('14. Límite de responsabilidad'),
        p('14.1 El Servicio es una herramienta. ' + P.brand + ' no garantiza resultados comerciales como más ventas, más visitas o más clientes.'),
        p('14.2 ' + P.brand + ' no responde por:'),
        ul([
          'daños indirectos, lucro cesante, pérdida de ventas u oportunidades de negocio;',
          'los premios, promociones, mensajes y trato que el Negocio dé a sus Clientes Finales;',
          'lo que se haga con los PIN del Negocio;',
          'fallas de internet, de los equipos del Negocio o de proveedores terceros;',
          'información incorrecta que registre el Negocio o su personal.'
        ]),
        p('14.3 En cualquier caso, la responsabilidad total de ' + P.brand + ' derivada de estos Términos se limita al monto que el Negocio haya pagado por el Servicio en los 3 meses anteriores al hecho que dio origen al reclamo.'),
        p('14.4 Estos límites no aplican en casos de dolo, mala fe o negligencia grave de ' + P.brand + ', ni cuando la ley no permita limitar la responsabilidad.'),

        h('15. Sacar en paz y a salvo'),
        p('El Negocio sacará en paz y a salvo a ' + P.brand + ', y le reembolsará los gastos razonables que tenga (incluidos honorarios de abogados), frente a reclamaciones de Clientes Finales, autoridades o terceros que se deriven de: su Programa, premios o promociones; los mensajes que envíe; el incumplimiento de sus obligaciones como responsable de datos personales; los logos o contenidos que suba; o el incumplimiento de estos Términos.'),
        p('A su vez, ' + P.brand + ' sacará en paz y a salvo al Negocio frente a reclamaciones que se deriven de incumplimientos de ' + P.brand + ' a sus obligaciones como encargado conforme al Anexo A, con el límite de la cláusula 14.3, salvo dolo o negligencia grave.'),

        h('16. Duración, cancelación y terminación'),
        p('16.1 El contrato inicia cuando aceptas estos Términos y se renueva por Periodos cada vez que pagas. No hay plazo forzoso ni penalización por cancelar.'),
        p('16.2 Puedes cancelar cuando quieras avisándonos por WhatsApp o correo. Tu acceso sigue hasta que termine el Periodo pagado y ya no se renueva. Antes de cancelar, debes avisar a tus Clientes Finales conforme a la cláusula 9.4.'),
        p('16.3 ' + P.brand + ' puede terminar el contrato: a) si el Negocio incumple gravemente y no corrige en 5 días hábiles, o de inmediato si hay usos ilícitos o riesgo para terceros; b) por falta de pago, conforme a la cláusula 7.3; o c) sin causa, avisando con 30 días naturales de anticipación y devolviendo la parte proporcional pagada y no usada.'),
        p('16.4 Al terminar el contrato: i) tienes 30 días naturales para descargar tu información, aunque el Panel esté en pausa; ii) durante esos 30 días tus Clientes Finales pueden seguir consultando su tarjeta, y después deja de funcionar; y iii) ' + P.brand + ' borrará tus datos y los de tus Clientes Finales dentro de los 90 días naturales siguientes, salvo lo que la ley obligue a conservar (por ejemplo, registros de pagos y facturación). Las copias de respaldo se eliminan en su ciclo normal.'),
        p('16.5 Siguen vigentes después de terminar el contrato las cláusulas sobre pagos pendientes, datos personales, propiedad intelectual, límite de responsabilidad, sacar en paz y a salvo, confidencialidad y jurisdicción.'),

        h('17. Confidencialidad'),
        p('Cada parte guardará en reserva la información no pública de la otra (datos de clientes, precios especiales, información técnica y comercial), salvo que la pida una autoridad competente o ya sea pública. Esta obligación dura mientras exista el contrato y 2 años después; respecto de datos personales, dura por tiempo indefinido.'),

        h('18. Cambios a estos Términos'),
        p('18.1 ' + P.brand + ' puede actualizar estos Términos. La versión vigente se publica en Redeo con su fecha.'),
        p('18.2 Te avisaremos de los cambios importantes con al menos 15 días naturales de anticipación, en tu Panel o por WhatsApp o correo, y te pediremos aceptarlos al entrar. Si no estás de acuerdo, puedes cancelar antes de que entren en vigor y te devolveremos la parte proporcional no usada de tu Periodo.'),
        p('18.3 Los cambios no afectan pagos ya hechos ni el precio del Periodo en curso.'),

        h('19. Caso fortuito y fuerza mayor'),
        p('Ninguna parte responde por incumplimientos causados por hechos fuera de su control razonable (desastres naturales, epidemias, fallas generales de internet o de energía, actos de autoridad, ataques informáticos a gran escala o fallas de los proveedores de la nube), mientras esos hechos duren.'),

        h('20. Avisos'),
        p('Las comunicaciones pueden hacerse por WhatsApp, correo electrónico o dentro del Panel, a los datos de contacto que cada parte haya dado. Los de ' + P.brand + ' son: correo ' + P.email + ' y WhatsApp ' + P.phone + '. Cada parte debe avisar si cambian sus datos.'),

        h('21. Cesión'),
        p('El Negocio no puede ceder este contrato sin autorización por escrito de ' + P.brand + '. ' + P.brand + ' puede cederlo a una sociedad que constituya o controle, o a quien adquiera el Servicio, avisándote; en ese caso tus derechos se mantienen.'),

        h('22. Disposiciones generales'),
        ul([
          'Las partes son independientes: este contrato no crea sociedad, relación laboral, agencia ni representación.',
          'Si alguna cláusula resulta inválida, las demás siguen vigentes.',
          'Que una parte no exija un derecho en un momento no significa que renuncie a él.',
          'Estos Términos, su Anexo A, la cotización y los avisos de privacidad forman el acuerdo completo entre las partes sobre el Servicio.',
          'Los títulos de las cláusulas y el resumen inicial son solo de referencia.'
        ]),

        h('23. Ley aplicable y tribunales'),
        p('Este contrato se rige por las leyes federales de los Estados Unidos Mexicanos y, en lo que corresponda, por las del Estado de Puebla. Las partes buscarán resolver de buena fe cualquier diferencia mediante negociación directa durante 15 días naturales. Si no lo logran, se someten a los tribunales competentes de la ciudad de Puebla, Puebla, y renuncian a cualquier otro fuero que pudiera corresponderles por su domicilio presente o futuro. Esto no limita los derechos que, en su caso, la ley reconozca al Negocio ante la Procuraduría Federal del Consumidor.'),

        { t: 'h', x: 'Anexo A. Acuerdo de tratamiento de datos personales (encargo)', annex: true },
        p('A.1 **Objeto.** El Negocio, como responsable, encarga a ' + P.brand + ', como encargado, el tratamiento de los Datos de Clientes con el único fin de prestar el Servicio. Las instrucciones del Negocio son: estos Términos, la configuración que haga en su Panel y las solicitudes que nos haga por escrito. Estas instrucciones incluyen generar estadísticas agregadas y anónimas conforme a la cláusula 10.4.'),
        p('A.2 **Datos y titulares.** Titulares: los Clientes Finales. Datos: nombre, teléfono celular, correo electrónico, día y mes de cumpleaños, visitas, sellos o puntos, canjes y sus fechas, productos comprados o favoritos, aceptación de promociones, teléfono de quien los invitó, la clave de su tarjeta y su dirección IP de uso temporal para seguridad. No se tratan datos personales sensibles.'),
        p('A.3 **Obligaciones de ' + P.brand + '.**'),
        ul([
          'Tratar los datos solo conforme a las instrucciones del Negocio y para prestar el Servicio.',
          'No usarlos para fines propios; no venderlos, rentarlos ni compartirlos con fines comerciales; y no contactar a los Clientes Finales por su cuenta.',
          'Guardar confidencialidad y exigirla a las personas que tengan acceso a los datos.',
          'Aplicar medidas de seguridad administrativas, físicas y técnicas razonables: conexión cifrada (HTTPS), acceso con PIN y bloqueo después de intentos fallidos, clave secreta por tarjeta, separación de la información de cada negocio, permisos distintos para dueño y personal, respaldos y acceso administrativo restringido.',
          'Avisar al Negocio sin demora, y a más tardar 72 horas después de confirmarla, de cualquier vulneración de seguridad que afecte sus datos, con la información disponible, y colaborar para que el Negocio informe a los titulares.',
          'Ayudar al Negocio a atender las solicitudes de acceso, rectificación, cancelación, oposición y revocación, principalmente con las herramientas del Panel (ver, corregir, borrar, apagar promociones y descargar).',
          'Borrar los datos al terminar el Servicio conforme a la cláusula 16.4, o entregarlos mediante la descarga.',
          'Dar al Negocio la información razonable para demostrar el cumplimiento de este Anexo y permitir revisiones razonables, con aviso previo de 15 días, a costa del Negocio y sin poner en riesgo la seguridad ni la información de otros clientes.'
        ]),
        p('A.4 **Proveedores (subencargados).** ' + P.brand + ' se apoya en proveedores de hospedaje en la nube (actualmente Railway Corporation, con servidores que pueden estar fuera de México, por ejemplo en Estados Unidos) y de servicios de Google para respaldos y, cuando el Cliente Final decide guardar su tarjeta ahí, para Google Wallet. ' + P.brand + ' elige proveedores que ofrecen medidas de seguridad razonables conforme a sus condiciones estándar, y responde frente al Negocio por el cumplimiento de sus propias obligaciones como encargado, sin perjuicio de las cláusulas 12.5 y 19. Avisaremos antes de agregar o cambiar proveedores que traten los datos; si tienes una objeción razonable, puedes cancelar con devolución proporcional.'),
        p('A.5 **Obligaciones del Negocio.** Dar a conocer su aviso de privacidad a sus clientes, recabar los datos de forma lícita, obtener el consentimiento para las finalidades que lo requieran (como las promociones), atender en plazo las solicitudes de sus clientes y dar solo instrucciones lícitas.'),
        p('A.6 **Responsabilidad.** Cada parte responde por sus propios incumplimientos. Si ' + P.brand + ' usara los datos para fines distintos a los instruidos, asumirá las obligaciones de responsable conforme a la ley.'),
        p('A.7 **Vigencia.** Este Anexo aplica mientras ' + P.brand + ' trate Datos de Clientes, incluso después de terminado el contrato y hasta su borrado.')
      ]
    };
  }

  // =====================================================================
  // 2) AVISO DE PRIVACIDAD DE P.A.E. (dueños, representantes y personal)
  // =====================================================================
  function privacidadPae(ctx) {
    var n = norm(ctx), P = n.P;
    return {
      id: 'privacidad-pae',
      kicker: 'Para negocios y sus contactos',
      title: 'Aviso de Privacidad Integral de ' + P.brand,
      blocks: [
        box('En palabras simples', [
          'Usamos tus datos para darte el servicio de Redeo, cobrarlo, facturarlo y darte soporte.',
          'No vendemos tus datos. No guardamos números de tarjeta bancaria.',
          'Si eres cliente de un negocio que usa Redeo, este aviso no es el tuyo: consulta el del negocio en su tarjeta.',
          'Puedes pedir ver, corregir o borrar tus datos escribiendo a ' + P.email + '.'
        ]),

        h('1. Responsable'),
        p(P.name + ', que opera con el nombre comercial ' + P.brand + ' y la plataforma Redeo, con domicilio en ' + P.address + ', es responsable del tratamiento de tus datos personales. Contacto de privacidad: ' + P.email + ' y WhatsApp ' + P.phone + '.'),

        h('2. A quién aplica'),
        p('A dueños, representantes y personal de los negocios que usan Redeo, y a las personas que nos piden información o una cotización.'),
        p('Si eres cliente de un negocio que usa Redeo, el responsable de tus datos es ese negocio, y ' + P.brand + ' solo los guarda por su encargo. Consulta el aviso de privacidad en la tarjeta del negocio o pregunta directamente ahí.'),

        h('3. Datos que tratamos'),
        ul([
          '**Identificación y contacto:** nombre, teléfono, WhatsApp, correo electrónico y puesto.',
          '**Del negocio:** nombre comercial, nombre o razón social, domicilio, giro y logo.',
          '**Fiscales, solo si pides factura:** RFC, régimen fiscal, código postal y uso del CFDI.',
          '**De pagos:** montos, fechas, forma de pago, referencias y folios. No recibimos ni guardamos números de tarjetas bancarias.',
          '**De uso del Panel:** constancia de aceptación de los Términos (nombre, fecha, hora, versión y dirección IP) y registros de seguridad, como intentos fallidos de PIN.',
          '**De soporte:** los mensajes que nos envías.'
        ]),
        p('No tratamos datos personales sensibles.'),

        h('4. Para qué usamos tus datos'),
        p('**Finalidades necesarias** para la relación que tienes con nosotros (no requieren tu consentimiento):'),
        ul([
          'Dar de alta y operar la cuenta de tu negocio.',
          'Prestar el Servicio y darte soporte y capacitación.',
          'Cobrar, emitir recibos y facturas, y recordarte pagos y vencimientos.',
          'Proteger la seguridad de la plataforma y prevenir fraudes o accesos indebidos.',
          'Guardar constancia de la aceptación de los Términos.',
          'Cumplir obligaciones fiscales y legales, y atender requerimientos de autoridades.'
        ]),
        p('**Finalidades adicionales** (puedes negarte en cualquier momento, sin que afecte tu servicio):'),
        ul([
          'Enviarte novedades, nuevas funciones, consejos y encuestas de satisfacción.',
          'Ofrecerte otros servicios de ' + P.brand + ' (por ejemplo, marketing o diseño).',
          'Mencionar a tu negocio como cliente o caso de éxito, solo con tu permiso expreso.'
        ]),
        p('Para negarte a las finalidades adicionales, escríbenos a ' + P.email + ' o por WhatsApp. Te incluiremos en nuestra lista de exclusión.'),

        h('5. Con quién compartimos tus datos'),
        p('**Remisiones.** Nos apoyamos en proveedores que nos ayudan a operar (hospedaje en la nube, correo, mensajería, contabilidad). Actúan como encargados, solo pueden usar tus datos para darnos su servicio y algunos pueden tener servidores fuera de México. Las remisiones a encargados no son transferencias y no requieren tu consentimiento.'),
        p('**Transferencias.** Solo compartimos tus datos, sin necesidad de tu consentimiento, en los casos del artículo 36 de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares: con el Servicio de Administración Tributaria (SAT) para emitir facturas, y con autoridades competentes cuando la ley lo exija.'),
        p('Si ' + P.brand + ' se constituye como sociedad o el Servicio pasa a otra persona, te avisaremos antes, y podrás oponerte y cancelar el servicio. No vendemos tus datos.'),

        h('6. Tus derechos (ARCO) y cómo revocar tu consentimiento'),
        p('Puedes **acceder** a tus datos, **rectificarlos**, **cancelarlos** u **oponerte** a su uso, y revocar tu consentimiento, enviando una solicitud a ' + P.email + ' con: tu nombre y un medio para responderte; un documento que acredite tu identidad o, en su caso, la representación; la descripción clara de los datos y del derecho que quieres ejercer; y cualquier dato que nos ayude a localizarlos. Si pides una rectificación, indica el cambio y adjunta el documento que la respalde.'),
        p('Te responderemos en un máximo de 20 días y, si procede, haremos efectiva tu solicitud dentro de los 15 días siguientes. Estos plazos pueden ampliarse una sola vez por un periodo igual cuando se justifique. El trámite es gratuito; solo podrían cobrarse gastos de envío o copias.'),
        p('Algunos datos no podrán borrarse mientras exista la relación o una obligación legal de conservarlos (por ejemplo, los fiscales).'),

        h('7. Cómo limitar el uso o divulgación de tus datos'),
        p('Puedes pedir que limitemos el uso o la divulgación de tus datos por los mismos medios del punto 6. También puedes inscribirte en el Registro Público para Evitar Publicidad (REPEP) de la PROFECO.'),

        h('8. Tecnologías del navegador'),
        p('El Panel guarda en tu navegador (almacenamiento local) el código de tu negocio y tu PIN para mantener tu sesión abierta. Cierra sesión si usas un equipo compartido. No usamos cookies de rastreo ni de publicidad. Las tipografías de la página se cargan desde Google Fonts, que puede recibir tu dirección IP.'),

        h('9. Conservación y seguridad'),
        p('Conservamos tus datos mientras dure la relación y, después, solo durante los plazos que exijan las leyes fiscales y mercantiles. Aplicamos medidas de seguridad administrativas, técnicas y físicas razonables para protegerlos.'),

        h('10. Cambios a este aviso'),
        p('Publicaremos cualquier cambio en Redeo con su fecha de actualización. Si el cambio es importante, te avisaremos en tu Panel o por WhatsApp o correo.'),

        h('11. Autoridad'),
        p('Si consideras que tus derechos no fueron atendidos, puedes acudir ante la Secretaría Anticorrupción y Buen Gobierno, autoridad en materia de protección de datos personales.')
      ]
    };
  }

  // =====================================================================
  // 3) AVISO DE PRIVACIDAD INTEGRAL PARA LOS CLIENTES DEL NEGOCIO
  // =====================================================================
  function privacidad(ctx) {
    var n = norm(ctx), P = n.P, B = n.B;
    return {
      id: 'privacidad',
      kicker: 'Programa de lealtad de ' + B.name,
      title: 'Aviso de Privacidad Integral',
      blocks: [
        box('En palabras simples', [
          B.name + ' usa tus datos para tu tarjeta de lealtad: registrar tus visitas, darte tus premios y dejarte abrir tu tarjeta desde cualquier celular.',
          'Solo recibirás promociones si lo aceptaste, y puedes apagarlas cuando quieras desde tu tarjeta.',
          'No vendemos tus datos. La plataforma Redeo los guarda por encargo del negocio.',
          'Puedes pedir ver, corregir o borrar tus datos ' + B.contact + '.'
        ]),

        h('1. Responsable'),
        p(B.legalName + ', que opera con el nombre comercial ' + B.name + ' (el **"Negocio"**), con domicilio en ' + B.address + ', es responsable del tratamiento de tus datos personales. Puedes contactarlo ' + B.contact + '.'),

        h('2. Datos que tratamos'),
        ul([
          '**Identificación y contacto:** nombre, teléfono celular y correo electrónico.',
          '**Tu cumpleaños:** solo día y mes, sin año.',
          '**De tu tarjeta:** visitas, sellos o puntos, premios canjeados, fechas y, en su caso, productos comprados.',
          '**Preferencias:** tus productos favoritos, si decides indicarlos, y si aceptas o no recibir promociones.',
          '**Invitaciones:** si llegaste por invitación de otra persona, su teléfono, para darle el beneficio que corresponda.',
          '**Técnicos:** la clave de tu tarjeta, que se guarda en tu celular, y tu dirección IP, que se usa de forma temporal para frenar abusos.'
        ]),
        p('**No tratamos datos personales sensibles.**'),

        h('3. Para qué usamos tus datos'),
        p('**Finalidades necesarias** para darte tu tarjeta:'),
        ul([
          'Inscribirte al programa y crear, aprobar y administrar tu tarjeta.',
          'Identificarte en caja por tu teléfono o tu código QR.',
          'Registrar tus visitas, sellos o puntos y canjes, y mostrarte tu avance e historial.',
          'Entregarte los premios y los beneficios automáticos que te correspondan cuando el Negocio los tenga activos (por ejemplo, sello de bienvenida, sellos dobles en tu cumpleaños o por invitar a alguien).',
          'Permitirte abrir tu tarjeta desde cualquier celular, confirmando tu teléfono y tu cumpleaños.',
          'Contactarte sobre tu tarjeta: enviarte su liga, avisarte que fue aprobada o aclarar un movimiento.',
          'Conocer tus productos favoritos, si decides indicarlos, para atenderte mejor.',
          'Atender tus dudas, quejas y solicitudes.',
          'Prevenir fraudes, tarjetas duplicadas y usos indebidos del programa.',
          'Cumplir obligaciones legales y atender requerimientos de autoridades.'
        ]),
        p('**Finalidades adicionales**, solo si las aceptas:'),
        ul([
          'Enviarte promociones, ofertas y novedades por WhatsApp, mensaje o correo.',
          'Felicitarte en tu cumpleaños con alguna oferta especial.',
          'Invitarte a regresar si tienes tiempo sin visitarnos.',
          'Ofrecerte promociones de acuerdo con tus productos favoritos.',
          'Invitarte a responder encuestas de satisfacción.'
        ]),
        p('Estas finalidades adicionales solo se activan si marcas la casilla "Quiero recibir promociones", que aparece sin marcar. Puedes apagarlas cuando quieras desde tu tarjeta o pidiéndolo al Negocio. Si no las aceptas, tu tarjeta funciona igual.'),

        h('4. Quién ve tus datos'),
        ul([
          '**Tú:** ves tu tarjeta completa desde tu liga personal o confirmando tu teléfono y tu cumpleaños.',
          '**El personal del Negocio:** ve lo necesario para atenderte en caja (nombre, teléfono, avance e historial).',
          '**El dueño del Negocio:** además ve tu correo, cumpleaños, favoritos y si aceptaste promociones.',
          '**Cualquier otra persona** que escriba tu teléfono en la página del Negocio solo ve tu primer nombre y que tienes tarjeta, nunca tu avance ni tus datos de contacto.'
        ]),

        h('5. Con quién compartimos tus datos'),
        p('El Negocio usa la plataforma Redeo, de ' + P.name + ' (' + P.brand + '), que guarda tus datos por su encargo y solo puede usarlos para prestarle ese servicio. ' + P.brand + ' se apoya en proveedores de hospedaje en la nube y de respaldo que pueden tener servidores fuera de México, por ejemplo en Estados Unidos. Estas remisiones a encargados no requieren tu consentimiento.'),
        p('Si el Negocio te escribe por WhatsApp, el mensaje viaja por ese servicio, que se rige por su propio aviso de privacidad.'),
        p('Si decides guardar tu tarjeta en Google Wallet o Apple Wallet (es opcional), tu nombre, teléfono, avance y premio se envían a ese servicio para mostrar tu tarjeta en tu celular y mantenerla al día. Ese servicio se rige además por su propio aviso de privacidad. Si pides que se borre tu tarjeta, también se desactiva en tu Wallet.'),
        p('No vendemos, rentamos ni transferimos tus datos a terceros para sus propios fines. Solo podríamos transferirlos sin tu consentimiento en los casos que permite el artículo 36 de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, por ejemplo, cuando lo exija una autoridad competente.'),

        h('6. Tus derechos (ARCO)'),
        p('Puedes **acceder** a tus datos, **rectificarlos** si están mal, **cancelarlos** u **oponerte** a su uso, ' + B.contact + '. Tu solicitud debe incluir: tu nombre y teléfono de la tarjeta; un medio para responderte; un documento que acredite tu identidad (o la de tu representante); qué datos y qué derecho quieres ejercer; y cualquier dato que ayude a localizarlos.'),
        p('El Negocio te responderá en un máximo de 20 días y, si procede, hará efectiva tu solicitud dentro de los 15 días siguientes. Estos plazos pueden ampliarse una sola vez por un periodo igual cuando se justifique. El trámite es gratuito.'),
        p('Algunas cosas las puedes hacer tú mismo, en cualquier momento, desde tu tarjeta: ver tus datos, tu avance y tu historial, y apagar las promociones. Si pides que se borre tu tarjeta, se eliminan también tu avance y tu historial, y no se pueden recuperar.'),

        h('7. Revocar tu consentimiento o limitar el uso de tus datos'),
        p('Puedes revocar tu consentimiento o pedir que se limite el uso de tus datos por los mismos medios del punto 6. Para dejar de recibir promociones basta con apagarlas desde tu tarjeta; el Negocio respeta esa preferencia como su lista de exclusión. También puedes inscribirte en el Registro Público para Evitar Publicidad (REPEP) de la PROFECO. Si revocas tu consentimiento para las finalidades necesarias, ya no podremos mantener tu tarjeta.'),

        h('8. Tecnologías de tu celular'),
        p('No usamos cookies de rastreo ni de publicidad. Tu navegador guarda tu teléfono y la clave de tu tarjeta (almacenamiento local) para abrirla directamente la próxima vez. Si borras los datos de tu navegador, puedes volver a abrirla con tu teléfono y tu cumpleaños. Las tipografías de la página se cargan desde Google Fonts, que puede recibir tu dirección IP.'),

        h('9. Cuánto tiempo guardamos tus datos'),
        p('Mientras tu tarjeta esté activa. Si pides que se borre, se elimina. Si tu tarjeta no tiene movimientos durante 24 meses, el Negocio podrá darla de baja, procurando avisarte antes por los medios de contacto que tenga. Si el Negocio deja de usar Redeo, tus datos se borran de la plataforma dentro de los 90 días siguientes. Las solicitudes de tarjeta que el Negocio rechace se borran.'),

        h('10. Seguridad'),
        p('Tus datos se protegen con conexión cifrada, claves por tarjeta, PIN para el personal del Negocio, bloqueo tras intentos fallidos y respaldos. Ningún sistema es infalible: no compartas la liga personal de tu tarjeta, porque quien la tenga podrá ver tu avance.'),

        h('11. Menores de edad'),
        p('El programa está dirigido a mayores de 18 años. Una persona menor de edad solo puede inscribirse en persona en el establecimiento, con su madre, padre o tutor presente, quien da el consentimiento en su nombre.'),

        h('12. Cambios a este aviso'),
        p('Cualquier cambio se publicará en esta misma página con su fecha de actualización. Si cambian las finalidades o los datos que tratamos, te avisaremos en tu tarjeta o por mensaje y te pediremos tu consentimiento cuando la ley lo exija.'),

        h('13. Autoridad'),
        p('Si consideras que tus derechos no fueron atendidos, puedes acudir ante la Secretaría Anticorrupción y Buen Gobierno, autoridad en materia de protección de datos personales.'),

        h('14. Tu consentimiento'),
        p('Al marcar la casilla "Acepto el Aviso de privacidad y los Términos del programa" y enviar tu solicitud, confirmas que leíste este aviso y consientes el uso de tus datos para las finalidades necesarias. Las finalidades adicionales solo se aplican si además marcas la casilla de promociones.')
      ]
    };
  }

  // =====================================================================
  // 4) TÉRMINOS DEL PROGRAMA DE LEALTAD (para los clientes del negocio)
  // =====================================================================
  function programa(ctx) {
    var n = norm(ctx), P = n.P, B = n.B;
    var how = B.mechanic === 'puntos'
      ? 'Ganas ' + (B.perVisit || '[[puntos por visita]]') + ' puntos por cada visita con compra registrada en caja. Al juntar ' + (B.goal || '[[meta]]') + ' puntos ganas: ' + B.reward + '.'
      : 'Recibes un sello por cada visita con compra registrada en caja. Al juntar ' + (B.goal || '[[meta]]') + ' sellos ganas: ' + B.reward + '.';
    var unit = B.mechanic === 'puntos' ? 'puntos' : 'sellos';
    return {
      id: 'programa',
      kicker: B.name,
      title: 'Términos del Programa de Lealtad',
      blocks: [
        box('En palabras simples', [
          'Es gratis y voluntario, para mayores de 18 años.',
          how,
          'Tus ' + unit + ' no caducan mientras el programa exista y tu tarjeta tenga al menos un movimiento cada 24 meses.',
          'Tu tarjeta es personal y el premio no se cambia por dinero.'
        ]),

        h('1. Quién organiza el programa'),
        p('El programa lo organiza ' + B.legalName + ', con el nombre comercial ' + B.name + ' (el **"Negocio"**), con domicilio en ' + B.address + '. El Negocio es el único responsable del programa y de sus premios. Redeo es solo la plataforma digital que ' + P.brand + ' le proporciona, y ' + P.brand + ' no es parte del programa.'),

        h('2. Quién puede participar'),
        ul([
          'Está dirigido a mayores de 18 años y es gratis y voluntario. Una persona menor de edad solo puede inscribirse en persona en el establecimiento, con su madre, padre o tutor presente, quien da el consentimiento en su nombre.',
          'Una tarjeta por número de celular en este Negocio. La tarjeta es personal y no se puede transferir.',
          'Puedes pedir tu tarjeta con el código QR o la liga del Negocio, o en persona. El Negocio aprueba cada solicitud y puede rechazar las que tengan datos incompletos, falsos o duplicados.'
        ]),

        h('3. Cómo sumas'),
        p(how),
        ul([
          'Los ' + unit + ' se registran en caja al momento de tu visita. Si no se registraron, pídelo en ese momento; el Negocio no está obligado a registrarlos después.',
          'Las promociones que se muestren en tu tarjeta (por ejemplo, ' + unit + ' dobles ciertos días, en tu cumpleaños o por invitar a alguien) se aplican solas durante su vigencia y en las condiciones que ahí se indican. No se acumulan entre sí salvo que se diga expresamente.',
          'Puedes ver tu avance y tu historial en tu tarjeta en cualquier momento.'
        ]),

        h('4. Tu premio'),
        ul([
          'Cuando completes tu tarjeta puedes canjear tu premio en el establecimiento: ' + B.reward + '.',
          'Al canjear se descuentan los ' + unit + ' del premio y tu tarjeta sigue sumando.',
          'El premio está sujeto a disponibilidad. Si no hay, el Negocio te ofrecerá algo de igual o mayor valor o te lo entregará después.',
          'El premio no se cambia por dinero, no es transferible y no se combina con otras promociones, salvo que el Negocio lo indique.',
          'Los ' + unit + ' y premios no tienen valor en dinero ni son un medio de pago.'
        ]),

        h('5. Vigencia'),
        p('Tus ' + unit + ' no caducan mientras el programa exista y tu tarjeta tenga al menos un movimiento (una visita o un canje) cada 24 meses. Si pasan 24 meses sin movimientos, el Negocio podrá darla de baja, procurando avisarte antes por los medios de contacto que tenga.'),

        h('6. Correcciones'),
        p('El Negocio puede corregir movimientos registrados por error (por ejemplo, un sello de más). Si no estás de acuerdo con un movimiento, avísale al Negocio dentro de los 30 días siguientes.'),

        h('7. Uso indebido'),
        p('No está permitido tener varias tarjetas, usar la de otra persona, alterar el sistema, obtener ' + unit + ' sin compra ni venderlos. Si esto pasa, el Negocio puede cancelar los ' + unit + ' obtenidos indebidamente o la tarjeta, explicándote el motivo.'),

        h('8. Cambios y fin del programa'),
        ul([
          'El Negocio puede cambiar el premio, la meta o las promociones avisando en tu tarjeta o en el establecimiento con al menos 15 días de anticipación. Los ' + unit + ' que ya tengas se respetan, y podrás canjear el premio anterior hasta 30 días después del aviso.',
          'Si el Negocio termina el programa, avisará con al menos 30 días de anticipación. Durante ese plazo podrás canjear las tarjetas completas.',
          'Las promociones temporales terminan en la fecha que se indique.'
        ]),

        h('9. Tu privacidad'),
        p('El uso de tus datos se explica en el Aviso de Privacidad Integral del Negocio, disponible en esta misma página.'),

        h('10. Dudas y quejas'),
        p('Atiende el Negocio, ' + B.contact + '. Tus derechos como consumidor ante la Procuraduría Federal del Consumidor (PROFECO) quedan siempre a salvo.'),

        h('11. Ley aplicable'),
        p('Este programa se rige por las leyes de los Estados Unidos Mexicanos.')
      ]
    };
  }

  var BUILDERS = { 'terminos': terminos, 'privacidad-pae': privacidadPae, 'privacidad': privacidad, 'programa': programa };
  var NEEDS_BIZ = { 'privacidad': true, 'programa': true };

  // "P.A.E." al final de una frase no lleva un segundo punto.
  function fixDots(t) { return typeof t === 'string' ? t.replace(/([A-ZÁÉÍÓÚ]\.)\.(?=\s|$|\*)/g, '$1') : t; }
  function build(id, ctx) {
    var f = BUILDERS[id];
    if (!f) return null;
    var d = f(ctx);
    d.title = fixDots(d.title);
    d.blocks.forEach(function (b) { if (b.x) b.x = fixDots(b.x); if (b.title) b.title = fixDots(b.title); if (b.items) b.items = b.items.map(fixDots); });
    d.version = VERSION;
    d.updated = UPDATED;
    return d;
  }

  // ---------- HTML ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[\[(.+?)\]\]/g, '<mark class="lg-miss" title="Dato por completar">$1</mark>');
  }
  function toHtml(d) {
    if (!d) return '';
    var out = ['<article class="lg-doc">',
      '<div class="lg-kicker">' + inline(d.kicker) + '</div>',
      '<h1 class="lg-title">' + inline(d.title) + '</h1>',
      '<div class="lg-updated">Última actualización: ' + esc(d.updated) + '</div>'];
    d.blocks.forEach(function (b) {
      if (b.t === 'h') out.push('<h2 class="lg-h' + (b.annex ? ' lg-annex' : '') + '">' + inline(b.x) + '</h2>');
      else if (b.t === 'p') out.push('<p class="lg-p">' + inline(b.x) + '</p>');
      else if (b.t === 'small') out.push('<p class="lg-small">' + inline(b.x) + '</p>');
      else if (b.t === 'ul') out.push('<ul class="lg-ul">' + b.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</ul>');
      else if (b.t === 'box') out.push('<div class="lg-box"><div class="lg-box-t">' + inline(b.title) + '</div><ul>' + b.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</ul></div>');
    });
    out.push('</article>');
    return out.join('');
  }

  // Lista de datos que faltan en un documento (para avisar al dueño o a P.A.E.).
  function missing(d) {
    var seen = {}, list = [];
    JSON.stringify(d).replace(/\[\[(.+?)\]\]/g, function (_, k) { if (!seen[k]) { seen[k] = 1; list.push(k); } });
    return list;
  }

  var api = {
    VERSION: VERSION, UPDATED: UPDATED,
    TITLES: {
      'terminos': 'Términos y Condiciones del Servicio',
      'privacidad-pae': 'Aviso de Privacidad de P.A.E.',
      'privacidad': 'Aviso de Privacidad',
      'programa': 'Términos del Programa'
    },
    NEEDS_BIZ: NEEDS_BIZ,
    build: build, toHtml: toHtml, missing: missing
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VuelveLegal = api;
})(typeof window !== 'undefined' ? window : this);
