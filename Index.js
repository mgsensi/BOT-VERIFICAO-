const express = require('express');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const app = express();

// ==========================================
// CONFIGURAÇÕES - PREENCHA COM SEUS DADOS:
// ==========================================
const TOKEN_DO_BOT = process.env.DISCORD_TOKEN;
const ID_DO_SERVIDOR = "1488414878212296874";
const ID_DO_CARGO = "1518425467361951745";

// IDs que aparecem na tela do Discord que você tirou print:
const CLIENT_ID = "1501459621259247616"; 
const CLIENT_SECRET = "cKQA5tOwjSdl-HfxLbRpCeXmeDqYKyQy";

// Chaves do Cloudflare Turnstile (Captcha):
const CHAVE_SECRETA_CLOUDFLARE = "1x0000000000000000000000000000000AA";
const CHAVE_DO_SITE_CLOUDFLARE = "1x00000000000000000000AA";

// Link final que o Render vai te dar (vamos atualizar depois):
const LINK_DO_RENDER = "https://bot-verificao-yyrv.onrender.com"; 
// ==========================================

const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
bot.login(TOKEN_DO_BOT);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota principal (Tela Inicial do Site)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verificação Anti-Raid</title>
            <style>
                body { background-color: #23272a; color: white; font-family: sans-serif; text-align: center; padding-top: 50px; }
                button { background-color: #5865F2; color: white; border: none; padding: 15px 30px; font-size: 16px; border-radius: 5px; cursor: pointer; font-weight: bold; }
                .box { background-color: #2c2f33; max-width: 400px; margin: 10px auto; padding: 30px; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>Verificação do Servidor</h2>
                <p>Clique no botão abaixo para iniciar a sua verificação.</p>
                <button onclick="iniciarLogin()">Verificar com o Discord</button>
            </div>
            <script>
                function iniciarLogin() {
                    window.location.href = "https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(LINK_DO_RENDER + '/callback')}&response_type=code&scope=identify";
                }
            </script>
        </body>
        </html>
    `);
});

// Rota de Callback (Onde o usuário resolve o CAPTCHA)
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("Código do Discord ausente.");

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Resolva o Captcha</title>
            <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
            <style>
                body { background-color: #23272a; color: white; font-family: sans-serif; text-align: center; padding-top: 80px; }
                .box { background-color: #2c2f33; max-width: 400px; margin: 10px auto; padding: 30px; border-radius: 8px; }
                button { background-color: #43b581; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-weight:bold; cursor:pointer; }
            </style>
        </head>
        <body>
            <div class="box">
                <h3>Último passo!</h3>
                <p>Por favor, resolva o desafio abaixo.</p>
                <form action="/finalizar-verificacao" method="POST">
                    <input type="hidden" name="code" value="${code}">
                    <div class="cf-turnstile" data-sitekey="${CHAVE_DO_SITE_CLOUDFLARE}"></div>
                    <br><br>
                    <button type="submit">Finalizar Verificação</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Rota final que valida o CAPTCHA e dá o cargo no Discord
app.post('/finalizar-verificacao', async (req, res) => {
    const { code, ['cf-turnstile-response']: token } = req.body;

    const respostaCloudflare = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', null, {
        params: { secret: CHAVE_SECRETA_CLOUDFLARE, response: token }
    });

    if (!respostaCloudflare.data.success) {
        return res.send("Falha no CAPTCHA. Tente novamente no celular.");
    }

    try {
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `${LINK_DO_RENDER}/callback`
        });

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const discordUserId = userResponse.data.id;

        const guild = await bot.guilds.fetch(ID_DO_SERVIDOR);
        const member = await guild.members.fetch(discordUserId);
        await member.roles.add(ID_DO_CARGO);

        res.send("<h1>✅ Verificado!</h1><p>Seu cargo foi aplicado. Pode voltar para o Discord.</p>");
    } catch (error) {
        console.error(error);
        res.send("Erro na verificação. Verifique se você já está dentro do servidor do Discord.");
    }
});

app.listen(3000, () => console.log('Servidor Online!'));
        
