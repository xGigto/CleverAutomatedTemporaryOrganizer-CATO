const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
require('dotenv').config({ path: './token.env' });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Funktion, die den Zeitstempel im gewünschten Format zurückgibt
const getTimestamp = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `[${day}-${month}-${year}/${hours}:${minutes}:${seconds}]`;
};

client.once('ready', async () => {
  console.log(`${getTimestamp()} * [INFO] Bot is ready! Made by Gigto™, @gigto on discord. Logged in as ${client.user.tag}`);

  client.guilds.cache.forEach(async (guild) => {
    console.log(`${getTimestamp()} * [INFO] Checking guild: ${guild.name}`);

    const createChannels = guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildVoice && channel.name.toLowerCase().includes('create')
    );

    createChannels.forEach(async (createChannel) => {
      console.log(`${getTimestamp()} * [INFO] Checking "Create" channel: ${createChannel.name}`);

      createChannel.members.forEach(async (member) => {
        if (!member.voice.channel || !member.voice.channel.name.toLowerCase().includes('temp')) {
          const tempChannel = await createTempChannel(createChannel, member);
          if (member.voice.channel) {
            await member.voice.setChannel(tempChannel).catch((error) => {
              console.error(`${getTimestamp()} ! [ERROR] Error while moving member to Temp channel:`, error);
            });
            console.log(`${getTimestamp()} ~ [MOVE] ${member.user.tag} was moved to the "Temp" channel from "${createChannel.name}"`);
          }

          monitorTempChannel(tempChannel);
        }
      });
    });

    const tempChannels = guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildVoice && channel.name === 'Temp'
    );

    tempChannels.forEach(async (tempChannel) => {
      const channel = await tempChannel.fetch().catch(console.error);
      if (channel && channel.members.size === 0) {
        await channel.delete().catch(console.error);
        console.log(`${getTimestamp()} > [DELETE] Deleted empty Temp channel: ${tempChannel.id}`);
      }
    });
  });
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const createChannel = newState.channel;

    if (createChannel && createChannel.name.toLowerCase().includes('create')) {
      console.log(`${getTimestamp()} * [INFO] User ${newState.member.user.tag} joined "Create" channel`);

      if (
        newState.member.voice.channel &&
        !newState.member.voice.channel.name.toLowerCase().includes('temp')
      ) {
        const tempChannel = await createTempChannel(createChannel, newState.member);
        if (newState.member.voice.channel) {
          await newState.member.voice.setChannel(tempChannel).catch((error) => {
            console.error(`${getTimestamp()} ! [ERROR] Error while moving member to Temp channel:`, error);
          });
          console.log(`${getTimestamp()} ~ [MOVE] ${newState.member.user.tag} was moved to the "Temp" channel from "${createChannel.name}"`);
        }

        monitorTempChannel(tempChannel);
      }
    }
  } catch (error) {
    console.error(`${getTimestamp()} ! [ERROR] Error in voiceStateUpdate handler:`, error);
  }
});

const createTempChannel = async (createChannel, member) => {
  console.log(`${getTimestamp()} + [CREATE] Creating Temp channel for member ${member.user.tag} in ${createChannel.name}`);
  const guild = createChannel.guild;

  const tempChannel = await guild.channels.create({
    name: 'Temp',
    type: ChannelType.GuildVoice,
    parent: createChannel.parent,
  });

  const permissions = createChannel.permissionOverwrites.cache.map((overwrite) => ({
    id: overwrite.id,
    allow: overwrite.allow.bitfield,
    deny: overwrite.deny.bitfield,
  }));

  await tempChannel.permissionOverwrites.set(permissions);
  await tempChannel.setPosition(createChannel.position + 1);

  return tempChannel;
};

const monitorTempChannel = (tempChannel) => {
  const checkChannelEmpty = async () => {
    try {
      const channel = await tempChannel.fetch().catch(console.error);
      if (channel && channel.members.size === 0) {
        await channel.delete().catch(console.error);
        console.log(`${getTimestamp()} - [DELETE] Deleted empty Temp channel: ${tempChannel.id}`);
      }
    } catch (error) {
      console.error(`${getTimestamp()} ! [ERROR] Error while checking and deleting temp channel:`, error);
    }
  };

  client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.channelId === tempChannel.id || newState.channelId === tempChannel.id) {
      checkChannelEmpty();
      if (newState.channelId === null) {
        console.log(`${getTimestamp()} * [INFO] ${newState.member.user.tag} left the "Temp" channel`);
      }
    }
  });
};

client.login(process.env.DISCORD_BOT_TOKEN);