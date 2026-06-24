/**
 * MSG91 WhatsApp API Integration
 * 
 * Templates configured in MSG91 dashboard:
 * 1. familyvault_expiry_reminder
 *    "Hello {{1}}, your {{2}} expires in {{3}} days. Open FamilyVault: {{4}}"
 * 
 * 2. familyvault_share_notify
 *    "Hello {{1}}, {{2}} has shared {{3}} with you on FamilyVault: {{4}}"
 */

export async function sendWhatsAppMessage(phone: string, templateName: string, variables: string[]): Promise<void> {
  try {
    const authKey = process.env.MSG91_AUTH_KEY;
    const integratedNumber = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER;

    if (!authKey || !integratedNumber) {
      console.warn('MSG91_AUTH_KEY or MSG91_WHATSAPP_INTEGRATED_NUMBER is not set. Skipping WhatsApp notification.');
      return;
    }

    // Format phone number to ensure it has no + but has country code.
    // If it comes with +91, we strip the +. MSG91 expects number with country code without +
    const formattedPhone = phone.replace(/^\+/, '');

    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify({
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: 'en',
              policy: 'deterministic'
            },
            components: [
              {
                type: 'body',
                parameters: variables.map(v => ({
                  type: 'text',
                  text: v
                }))
              }
            ]
          },
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                body_1: {
                  type: 'text',
                  value: variables[0] || ''
                },
                body_2: {
                  type: 'text',
                  value: variables[1] || ''
                },
                body_3: {
                  type: 'text',
                  value: variables[2] || ''
                },
                body_4: {
                  type: 'text',
                  value: variables[3] || ''
                }
              }
            }
          ]
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MSG91 API returned ${response.status}: ${errorText}`);
    } else {
      console.log(`WhatsApp message sent to ${formattedPhone} using template ${templateName}`);
    }
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    // Never throw, fail silently for notifications
  }
}
