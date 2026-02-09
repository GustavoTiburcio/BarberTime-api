/**
 * Utilitário para envio de mensagens WhatsApp via WhatsGw
 */

interface WhatsAppConfig {
  apikey: string;
  phoneNumber: string; // Número do estabelecimento (origem)
}

interface BookingNotificationData {
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  serviceName: string;
  professionalName: string;
  status?: string;
}

/**
 * Envia notificação de agendamento via WhatsApp
 */
export async function sendBookingConfirmation(
  bookingData: BookingNotificationData,
  config?: WhatsAppConfig
): Promise<boolean> {
  try {
    // Configuração padrão (pode ser sobrescrita por variáveis de ambiente)
    const apikey = config?.apikey || process.env.WHATSAPP_API_KEY || '';
    const phoneNumber = config?.phoneNumber || process.env.WHATSAPP_PHONE_NUMBER || '';

    // Validar configuração
    if (!apikey || !phoneNumber) {
      console.warn('WhatsApp: Configuração incompleta (apikey ou phoneNumber ausente)');
      return false;
    }

    // Formatar a data para exibição
    const formattedDate = formatDate(bookingData.date);
    const formattedTime = bookingData.time.substring(0, 5); // HH:MM

    // Montar mensagem formatada
    const message = `
🎉 *Agendamento Confirmado!*

Olá *${bookingData.clientName}*! ✨

Seu agendamento foi confirmado com sucesso:

📅 *Data:* ${formattedDate}
🕐 *Horário:* ${formattedTime}
💈 *Serviço:* ${bookingData.serviceName}
👤 *Profissional:* ${bookingData.professionalName}

_Aguardamos você! Qualquer dúvida, entre em contato._

Até breve! 👋
    `.trim();

    // Preparar payload para a API
    const payload = {
      apikey,
      phone_number: phoneNumber,
      contact_phone_number: bookingData.clientPhone,
      message_custom_id: 'barbertime',
      message_type: 'text',
      message_body: message,
    };

    // Enviar requisição para a API WhatsGw
    const response = await fetch('https://app.whatsgw.com.br/api/WhatsGw/Send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp: Erro ao enviar mensagem:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('WhatsApp: Mensagem enviada com sucesso', result);
    return true;
  } catch (error) {
    console.error('WhatsApp: Erro ao enviar notificação:', error);
    return false;
  }
}

/**
 * Envia notificação de atualização de status
 */
export async function sendStatusUpdate(
  bookingData: BookingNotificationData,
  config?: WhatsAppConfig
): Promise<boolean> {
  try {
    const apikey = config?.apikey || process.env.WHATSAPP_API_KEY || '';
    const phoneNumber = config?.phoneNumber || process.env.WHATSAPP_PHONE_NUMBER || '';

    if (!apikey || !phoneNumber) {
      console.warn('WhatsApp: Configuração incompleta');
      return false;
    }

    const formattedDate = formatDate(bookingData.date);
    const formattedTime = bookingData.time.substring(0, 5);

    let statusText = '';
    let emoji = '';

    switch (bookingData.status?.toLowerCase()) {
      case 'confirmed':
        statusText = 'Confirmado';
        emoji = '✅';
        break;
      case 'cancelled':
        statusText = 'Cancelado';
        emoji = '❌';
        break;
      case 'completed':
        statusText = 'Concluído';
        emoji = '🎉';
        break;
      default:
        statusText = bookingData.status || 'Atualizado';
        emoji = 'ℹ️';
    }

    const message = `
${emoji} *Status do Agendamento Atualizado*

Olá *${bookingData.clientName}*,

Seu agendamento foi atualizado:

📅 *Data:* ${formattedDate}
🕐 *Horário:* ${formattedTime}
💈 *Serviço:* ${bookingData.serviceName}
👤 *Profissional:* ${bookingData.professionalName}
📊 *Status:* ${statusText}

${bookingData.status?.toLowerCase() === 'cancelled'
  ? '_Se houver alguma dúvida, entre em contato._'
  : '_Obrigado pela preferência!_'}
    `.trim();

    const payload = {
      apikey,
      phone_number: phoneNumber,
      contact_phone_number: bookingData.clientPhone,
      message_custom_id: 'barbertime_status',
      message_type: 'text',
      message_body: message,
    };

    const response = await fetch('https://app.whatsgw.com.br/api/WhatsGw/Send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('WhatsApp: Erro ao enviar mensagem de status');
      return false;
    }

    console.log('WhatsApp: Mensagem de status enviada');
    return true;
  } catch (error) {
    console.error('WhatsApp: Erro ao enviar atualização de status:', error);
    return false;
  }
}

/**
 * Formata data para exibição em português
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString + 'T00:00:00');
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ];

    const dayOfWeek = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];

    return `${dayOfWeek}, ${day} de ${month}`;
  } catch {
    return dateString;
  }
}
