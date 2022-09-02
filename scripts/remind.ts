// Description:
//   Create a reminder message
//
//   Lightly based on hubot-schedule by matsukaz <matsukaz@gmail.com>
//
// Dependencies:
//   "lodash"        : "^4.17.14",
//   "chrono-node"   : "^1.3.11",
//
// Commands:
//   hubot remind [me|team|here] <day or date in English> <message> - Create a reminder, in the current flow, that runs at a specific date and time, using regular English syntax to describe the date/time. See https://www.npmjs.com/package/chrono-node for examples of accepted date formats. Note: you CAN include a timezone in your request, but all times will be Displayed in UTC.
//   hubot reminder [cancel|del|delete|remove] <id> - Cancel the reminder for the specified id.
//   hubot reminder [upd|update] <id> <message> - Update the message for the reminder with the specified id.
//   hubot reminder list - List all reminders for the current flow or DM. NOTE all times are displayed in UTC.
//   hubot reminder list <flow> - List all reminders for the specified flow. NOTE all times are displayed in UTC.
//   hubot reminder list all - List all reminders for any public flows (reminders in DMs or invite-only flows are hidden from this list, except when called from a DM or private flow). NOTE all times are displayed in UTC.
//
// Author:
//   kb0rg
//

import * as _ from "lodash"
import * as chrono from "chrono-node"

import {
  getRoomIdFromName,
  robotIsInRoom,
  isRoomNonPublic,
  getPublicJoinedRoomIds,
} from "../lib/adapter-util"

import {
  CONFIG,
  syncSchedules,
  createScheduledJob,
  isBlank,
  updateScheduledJob,
  cancelScheduledJob,
  getScheduledJobList,
  formatJobsForListMessage,
  MessageMetadata,
} from "../lib/schedule-util"
import { Robot } from "hubot"
import { MatrixMessage } from "hubot-matrix"

const REMINDER_JOBS = {}
const REMINDER_KEY = "hubot_reminders"

module.exports = function (robot: Robot) {
  robot.brain.on("loaded", () => {
    return syncSchedules(robot, REMINDER_KEY, REMINDER_JOBS)
  })

  if (!robot.brain.get(REMINDER_KEY)) {
    robot.brain.set(REMINDER_KEY, {})
  }

  robot.respond(/remind (me|team|here) ((?:.|\s)*)$/i, function (msg) {
    const whoToTag: { [name: string]: string } = {
      me: `@${msg.message.user.name}, `,
      here: "@here, ",
      team: "@room, ",
    }

    const who = msg.match[1]
    const message = whoToTag[who] ?? ""
    const metadata: MessageMetadata =
      "metadata" in msg.message
        ? {
            ...(msg.message as MatrixMessage).metadata,
            messageId: msg.message.id,
          }
        : { messageId: msg.message.id }

    try {
      const inputString = msg.match[2]
      const parsedText = chrono.parse(inputString, new Date(), {
        forwardDate: true,
      })

      if (!parsedText[0]) {
        robot.logger.error(
          `Could not parse datetime from text: ${inputString}.`,
        )
        return msg.reply(`Sorry, I can't extract a date from your request.
          See https://www.npmjs.com/package/chrono-node for examples of accepted date formats.
          If you're trying to schedule a recurring reminder, try using the \`schedule\` command:
          See \`help schedule\` for more information.
          `)
      }

      let { index: dateTextIndex, text: dateText, start: date } = parsedText[0]
      let messageText = inputString.substring(dateTextIndex + dateText.length)
      messageText += messageText.replace(/^\s*to\s*/i, "")

      let resp = createScheduledJob(
        robot,
        REMINDER_JOBS,
        REMINDER_KEY,
        msg.message.user,
        msg.message.user.room,
        date.date(),
        message,
        metadata,
        true, // remindInThread: default to true for remind jobs
      )

      if (resp !== undefined) {
        msg.reply(resp)
      }
    } catch (error) {
      robot.logger.error(`createScheduledJob Error: ${error.message}`)
      msg.reply("Something went wrong adding this reminder.")
    }
  })

  robot.respond(/reminder list(?: (all|.*))?/i, async function (msg) {
    let rooms, outputPrefix
    const targetRoom = msg.match[1]
    const roomId = msg.message.user.room // room command is called from
    let targetRoomId = null
    let output = ""
    let calledFromDm = typeof roomId === "undefined"

    // If targetRoom is specified, check whether list for is permitted.
    if (!isBlank(targetRoom) && targetRoom != "all") {
      targetRoomId = getRoomIdFromName(robot.adapter, targetRoom)
      if (
        targetRoomId === undefined ||
        !(await robotIsInRoom(robot.adapter, targetRoomId))
      ) {
        return msg.reply(
          `Sorry, I'm not in the ${targetRoom} flow - or maybe you mistyped?`,
        )
      }
      if (targetRoomId && isRoomNonPublic(robot.adapter, targetRoomId)) {
        if (msg.message.user.room != targetRoomId) {
          return msg.reply(
            `Sorry, that's a private flow. I can only show jobs scheduled from that flow from within the flow.`,
          )
        }
      }
    }

    // only get DMs from user who called list, if user calls list from a DM
    let userIdForDMs = calledFromDm ? msg.message.user.id : null

    // Construct params for getting and formatting job list
    if (isBlank(targetRoom) || CONFIG.denyExternalControl === "1") {
      // If targetRoom is undefined or blank, show schedule for current room.
      // Room is ignored when HUBOT_SCHEDULE_DENY_EXTERNAL_CONTROL is set to 1
      rooms = [roomId]
    } else if (targetRoom === "all") {
      // Get list of public rooms.
      rooms = getPublicJoinedRoomIds(robot.adapter)
      // If called from a private room, add to list.
      calledFromPrivateRoom = !calledFromDm
        ? isRoomInviteOnly(robot.adapter, robot.adapterName, roomId)
        : false
      if (calledFromPrivateRoom) {
        rooms.push(roomId)
      }
    } else {
      // If targetRoom is specified, show jobs for that room.
      rooms = [targetRoomId]
    }

    // Construct message string prefix
    outputPrefix = "Showing scheduled reminders for "
    if (isBlank(targetRoom) || CONFIG.denyExternalControl === "1") {
      outputPrefix += "THIS flow:\n"
    } else if (targetRoom === "all") {
      // If called from a private room, add to list.
      if (calledFromPrivateRoom) {
        outputPrefix += "THIS flow AND "
      }
      outputPrefix += "all public flows:\n"
    } else {
      // If targetRoom is specified, show jobs for that room if allowed.
      outputPrefix += `the ${targetRoom} flow:\n`
    }

    try {
      let [dateJobs] = getScheduledJobList(REMINDER_JOBS, rooms, userIdForDMs)
      output = formatJobsForListMessage(robot.adapter, dateJobs, false)

      if (!!output.length) {
        output = outputPrefix + "===\n" + output
        return msg.reply(output)
      } else {
        return msg.reply("No reminders have been scheduled")
      }
    } catch (error) {
      robot.logger.error(
        `Error getting or formatting reminder job list: ${error.message}\nFull error: %o`,
        error,
      )
      msg.reply("Something went wrong getting the reminder list.")
    }
  })

  robot.respond(/reminder (?:upd|update) (\d+) ((?:.|\s)*)/i, (msg) => {
    try {
      let resp = updateScheduledJob(
        robot,
        REMINDER_JOBS,
        REMINDER_KEY,
        msg,
        msg.match[1],
        msg.match[2],
      )
      msg.reply(resp)
    } catch (error) {
      robot.logger.error(`updateScheduledJob Error: ${error.message}`)
      msg.reply("Something went wrong updating this reminder.")
    }
  })

  return robot.respond(
    /reminder (?:del|delete|remove|cancel) (\d+)/i,
    (msg) => {
      try {
        let resp = cancelScheduledJob(
          robot,
          REMINDER_JOBS,
          REMINDER_KEY,
          msg,
          msg.match[1],
        )
        msg.reply(resp)
      } catch (error) {
        robot.logger.error(`updateScheduledJob Error: ${error.message}`)
        msg.reply("Something went wrong deleting this reminder.")
      }
    },
  )
}