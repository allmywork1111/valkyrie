import { ApplicationCommandOptionType, Client, TextChannel } from "discord.js"
import axios from "axios"
import { Robot } from "hubot"

// This is the WIP discord implementation of commands to trigger certain workflows on the thesis n8n platform. Most of the integration uses webhooks and chat commands with response headers .
export default async function manageFjord(discordClient: Client, robot: Robot) {
  const guildId = "597157463033100784"
  const guild = discordClient.guilds.cache.get(guildId)

  if (!guild) {
    robot.logger.error(`Guild with ID ${guildId} not found.`)
    return
  }

  guild.commands.set([
    {
      name: "debug",
      description: "Runs the debug command, sending logs to Valkyrie console",
    },
    {
      name: "stale-issues",
      description: "Retrieve stale issues from specific git repository",
      options: [
        {
          name: "repository-owner",
          type: ApplicationCommandOptionType.String,
          description: "The owner of the repository",
          required: true,
        },
        {
          name: "repository-name",
          type: ApplicationCommandOptionType.String,
          description: "The name of the repository",
          required: true,
        },
      ],
    },
    {
      name: "issues",
      description: "Retrieve recent issues from specific git repository",
      options: [
        {
          name: "repository-owner",
          type: ApplicationCommandOptionType.String,
          description: "The owner of the repository",
          required: true,
        },
        {
          name: "repository-name",
          type: ApplicationCommandOptionType.String,
          description: "The name of the repository",
          required: true,
        },
      ],
    },
    {
      name: "activity",
      description: "Retrieve activity summary from specific git repository",
      options: [
        {
          name: "repository-owner",
          type: ApplicationCommandOptionType.String,
          description: "The owner of the repository",
          required: true,
        },
        {
          name: "repository-name",
          type: ApplicationCommandOptionType.String,
          description: "The name of the repository",
          required: true,
        },
      ],
    },
    {
      name: "exec",
      description: "Run specific workflow from n8n",
      options: [
        {
          name: "workflow-name",
          type: ApplicationCommandOptionType.String,
          description: "The name of the workflow to run",
          required: true,
        },
      ],
    },
  ])

  if (process.env.HUBOT_N8N_WEBHOOK) {
    discordClient.on("interactionCreate", async (interaction) => {
      if (
        (interaction.isButton() && interaction.customId.startsWith("debug")) ||
        (interaction.isCommand() && interaction.commandName === "debug")
      ) {
        robot.logger.info("adapter in use:", robot.adapter)

        await interaction.reply({
          content: "**Debugger running, check your console ;)**",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: "Run again",
                  style: 1,
                  custom_id: "debug",
                },
              ],
            },
          ],
        })
      }

      if (
        interaction.isCommand() &&
        interaction.commandName === "stale-issues"
      ) {
        const { channelId } = interaction
        const channel = discordClient.channels.cache.get(channelId)
        const repositoryOwnerOption =
          interaction.options.get("repository-owner")
        const repositoryNameOption = interaction.options.get("repository-name")
        if (
          repositoryOwnerOption &&
          typeof repositoryOwnerOption.value === "string" &&
          repositoryNameOption &&
          typeof repositoryNameOption.value === "string"
        ) {
          const repositoryOwner = repositoryOwnerOption.value
          const repositoryName = repositoryNameOption.value

          const webhookUrl = process.env.HUBOT_N8N_WEBHOOK
          const queryParams = new URLSearchParams({
            repositoryOwner,
            repositoryName,
          })

          await interaction.reply({
            content: `**Stale issue automation:  ${repositoryOwner} / ${repositoryName}**`,
          })
          const options = {
            headers: {
              workflowType: "stale-issues",
            },
          }
          axios
            .get(`${webhookUrl}?${queryParams.toString()}`, options)
            .then(async (response) => {
              if (channel instanceof TextChannel) {
                const thread = await channel.threads.create({
                  name: `Stale issues: ${repositoryOwner} ${repositoryName}`,
                  autoArchiveDuration: 60,
                })
                await thread.send("@here")
                await thread.send(response.data)
              }
            })
            .catch((error) => {
              interaction.followUp(
                `Automation stale-issues flow failed: ${error.message}`,
              )
            })
        }
      }

      if (interaction.isCommand() && interaction.commandName === "issues") {
        const { channelId } = interaction
        const channel = discordClient.channels.cache.get(channelId)
        const repositoryOwnerOption =
          interaction.options.get("repository-owner")
        const repositoryNameOption = interaction.options.get("repository-name")
        if (
          repositoryOwnerOption &&
          typeof repositoryOwnerOption.value === "string" &&
          repositoryNameOption &&
          typeof repositoryNameOption.value === "string"
        ) {
          const repositoryOwner = repositoryOwnerOption.value
          const repositoryName = repositoryNameOption.value

          const webhookUrl = process.env.HUBOT_N8N_WEBHOOK
          const queryParams = new URLSearchParams({
            repositoryOwner,
            repositoryName,
          })

          await interaction.reply({
            content: `**Git issues automation:  ${repositoryOwner} / ${repositoryName}**`,
          })
          const options = {
            headers: {
              workflowType: "issues",
            },
          }
          axios
            .get(`${webhookUrl}?${queryParams.toString()}`, options)
            .then(async (response) => {
              if (channel instanceof TextChannel) {
                const thread = await channel.threads.create({
                  name: `Issues: ${repositoryOwner} ${repositoryName}`,
                  autoArchiveDuration: 60,
                })
                await thread.send("@here")
                await thread.send(response.data)
              }
            })
            .catch((error) => {
              interaction.followUp(
                `Automation issues flow failed: ${error.message}`,
              )
            })
        }
      }

      if (interaction.isCommand() && interaction.commandName === "activity") {
        const { channelId } = interaction
        const channel = discordClient.channels.cache.get(channelId)
        const repositoryOwnerOption =
          interaction.options.get("repository-owner")
        const repositoryNameOption = interaction.options.get("repository-name")
        if (
          repositoryOwnerOption &&
          typeof repositoryOwnerOption.value === "string" &&
          repositoryNameOption &&
          typeof repositoryNameOption.value === "string"
        ) {
          const repositoryOwner = repositoryOwnerOption.value
          const repositoryName = repositoryNameOption.value

          const webhookUrl = process.env.HUBOT_N8N_WEBHOOK
          const queryParams = new URLSearchParams({
            repositoryOwner,
            repositoryName,
          })

          await interaction.reply({
            content: `**Git activity automation:  ${repositoryOwner} / ${repositoryName}**`,
          })
          const options = {
            headers: {
              workflowType: "activity",
            },
          }
          axios
            .get(`${webhookUrl}?${queryParams.toString()}`, options)
            .then(async (response) => {
              if (channel instanceof TextChannel) {
                const thread = await channel.threads.create({
                  name: `Git Activity: ${repositoryOwner} ${repositoryName}`,
                  autoArchiveDuration: 60,
                })
                await thread.send("@here")
                await thread.send(response.data)
              }
            })
            .catch((error) => {
              interaction.followUp(
                `Automation activity flow failed: ${error.message}`,
              )
            })
        }
      }

      if (interaction.isCommand() && interaction.commandName === "exec") {
        const { channelId } = interaction
        const channel = discordClient.channels.cache.get(channelId)
        const workflowNameOption = interaction.options.get("workflow-name")
        if (
          workflowNameOption &&
          typeof workflowNameOption.value === "string"
        ) {
          const workflowName = workflowNameOption.value

          const webhookUrl = process.env.HUBOT_N8N_WEBHOOK
          const queryParams = new URLSearchParams({
            workflowName,
          })

          await interaction.reply({
            content: `**Exec automation:  ${workflowName}**`,
          })
          const options = {
            headers: {
              workflowType: "exec",
            },
          }
          axios
            .get(`${webhookUrl}?${queryParams.toString()}`, options)
            .then(async (response) => {
              if (channel instanceof TextChannel) {
                const thread = await channel.threads.create({
                  name: `Exec: ${workflowName}`,
                  autoArchiveDuration: 60,
                })
                await thread.send("@here")
                await thread.send(response.data)
              }
            })
            .catch((error) => {
              interaction.followUp(
                `Automation activity flow failed: ${error.message}`,
              )
            })
        }
      }
    })
  }
}
