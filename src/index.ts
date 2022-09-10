import { config } from "dotenv";
config();

import pronote, { Lesson } from "@redboxing/pronote-api";
import moment from "moment";

import {
	Client,
	GatewayIntentBits,
	EmbedBuilder,
	TextChannel,
	ColorResolvable,
} from "discord.js";

import prisma from "./database";

(async () => {
	let session: pronote.PronoteStudentSession;

	try {
		session = await pronote.login(
			process.env.PRONOTE_URL,
			process.env.PRONOTE_USERNAME,
			process.env.PRONOTE_PASSWORD,
			process.env.PRONOTE_EDUCONNECT === "true"
				? "ac-grenoble2"
				: "ac-grenoble"
		);

		session.setKeepAlive(true);
	} catch (err) {
		console.log(err);
	}

	const client = new Client({
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
	});

	client.on("ready", () => {
		syncPronote();
		setInterval(syncPronote, 10 * 60 * 1000);
	});

	async function syncPronote() {
		console.log("Syncing pronote...");

		await syncInfos();
		await syncHomeworks();
		await syncLessons();
		await syncMarks();

		console.log("Synced pronote.");
	}

	async function syncMarks() {
		const marks = await session.marks();

		for (const subject of marks.subjects) {
			for (const mark of subject.marks) {
				const dbMark = await prisma.mark.findFirst({
					where: {
						id: mark.id,
					},
				});

				if (dbMark) return;

				await prisma.mark.create({
					data: {
						id: mark.id,
						subject: subject.name,
						title: mark.title,
						value: mark.value,
						coefficient: mark.coefficient,
						scale: mark.scale,
						averageClass: mark.average,
						min: mark.min,
						max: mark.max,
						date: mark.date,
						isAway: mark.isAway,
					},
				});

				const embed = new EmbedBuilder()
					.setTitle(`Nouvelle note : ${subject.name}`)
					.setDescription(
						`${mark.title}\n\nInformations Note:\nNote Elève: ${
							mark.value || "Non Noté"
						}/${mark.scale}\n Note Min: ${mark.min}/${
							mark.scale
						}\n Note Max: ${mark.max}/${
							mark.scale
						}\n Moyenne Classe: ${mark.average}/${
							mark.scale
						}\n Coefficient: ${
							mark.coefficient
						}\n\nInformation Matière:\nMoyenne Elève: ${
							subject.averages.student
						}/20\nMoyenne Classe: ${
							subject.averages.studentClass
						}/20\nMoyenne Min: ${
							subject.averages.min
						}/20\nMoyenne Max: ${subject.averages.max}/20`
					)
					.setFooter({
						text: `Note du ${moment(mark.date)
							.locale("fr")
							.format("dddd Do MMMM")}`,
					})
					.setColor(subject.color as ColorResolvable)
					.setURL(process.env.PRONOTE_URL);

				client.channels
					.fetch(process.env.DISCORD_PRONOTE_CHANNEL)
					.then((channel: TextChannel) => {
						channel.send({
							embeds: [embed],
						});
					});
			}
		}
	}

	async function syncLessons() {
		const nextWeekDate = new Date(Date.now());
		nextWeekDate.setDate(nextWeekDate.getDate() + 30);
		const timetable = await session.timetable(
			new Date(Date.now()),
			nextWeekDate
		);
		const dbLessons = await prisma.lesson.findMany({
			where: {
				from: {
					gte: new Date(Date.now()),
					lte: nextWeekDate,
				},
			},
		});

		const editedLessons: Lesson[] = timetable.filter(t => {
			const dbLesson = dbLessons.find(l => l.id == t.id);
			if (dbLesson != undefined) {
				return (
					dbLesson.isAway != t.isAway ||
					dbLesson.isCancelled ||
					t.isCancelled ||
					dbLesson.subject != t.subject ||
					dbLesson.room != t.room ||
					dbLesson.teacher != t.teacher
				);
			}

			return t.isAway || t.isCancelled;
		});

		for (const lesson of editedLessons) {
			const dbLesson = dbLessons.find(l => l.id == lesson.id);
			const embed = new EmbedBuilder()
				.setFooter({
					text: `Cour du ${moment(lesson.from)
						.locale("fr")
						.format("dddd Do MMMM")} de ${moment(lesson.from)
						.locale("fr")
						.format("hh:mm")} a ${moment(lesson.to)
						.locale("fr")
						.format("hh:mm")}`,
				})
				.setColor(lesson.color as ColorResolvable)
				.setURL(process.env.PRONOTE_URL);

			if (
				(dbLesson == undefined && lesson.isAway) ||
				(dbLesson != undefined && dbLesson.isAway != lesson.isAway)
			) {
				embed.setTitle(`Professeur de ${lesson.subject} Absent !`);
				embed.setDescription(
					`Le professeur ${lesson.teacher} du cour de ${
						lesson.subject
					} sera absent le ${moment(lesson.from)
						.locale("fr")
						.format("dddd Do MMMM")} de ${moment(lesson.from)
						.locale("fr")
						.format("hh:mm")} a ${moment(lesson.to)
						.locale("fr")
						.format("hh:mm")}`
				);
			} else if (
				(dbLesson == undefined && lesson.isCancelled) ||
				(dbLesson != undefined &&
					dbLesson.isCancelled != lesson.isCancelled)
			) {
				embed.setTitle(`Cour de ${lesson.subject} annulé !`);
				embed.setDescription(
					`Le cour de ${lesson.subject} sera annulé le ${moment(
						lesson.from
					)
						.locale("fr")
						.format("dddd Do MMMM")} de ${moment(lesson.from)
						.locale("fr")
						.format("hh:mm")} a ${moment(lesson.to)
						.locale("fr")
						.format("hh:mm")}`
				);
			} else if (dbLesson != undefined && dbLesson.room != lesson.room) {
				embed.setTitle("Changemement de salle !");
				embed.setDescription(
					`La salle du cour de ${
						lesson.subject
					} a été changer de la salle ${dbLesson.room} a la salle ${
						lesson.room
					} le ${moment(lesson.from)
						.locale("fr")
						.format("dddd Do MMMM")} de ${moment(lesson.from)
						.locale("fr")
						.format("hh:mm")} a ${moment(lesson.to)
						.locale("fr")
						.format("hh:mm")}`
				);
			} else if (
				dbLesson != undefined &&
				dbLesson.subject != lesson.subject
			) {
				embed.setTitle("Changement de cour !");
				embed.setDescription(
					`Le cour de ${dbLesson.subject} a été changer en cour de ${
						lesson.subject
					} le ${moment(lesson.from)
						.locale("fr")
						.format("dddd Do MMMM")} de ${moment(lesson.from)
						.locale("fr")
						.format("hh:mm")} a ${moment(lesson.to)
						.locale("fr")
						.format("hh:mm")}`
				);
			} else if (
				dbLesson != undefined &&
				dbLesson.teacher != lesson.teacher
			) {
				embed.setTitle("Changemement de professeur !");
				embed.setDescription(
					`Le cour de ${
						lesson.subject
					} a eu un changement de professeur de ${
						dbLesson.teacher
					} a ${lesson.teacher} le ${moment(lesson.from)
						.locale("fr")
						.format("dddd Do MMMM")} de ${moment(lesson.from)
						.locale("fr")
						.format("hh:mm")} a ${moment(lesson.to)
						.locale("fr")
						.format("hh:mm")}`
				);
			}

			if (dbLesson == undefined) {
				await prisma.lesson.create({
					data: lesson,
				});
			} else {
				await prisma.lesson.update({
					where: {
						id: dbLesson.id,
					},
					data: lesson,
				});
			}

			if (embed.data.title != undefined) {
				client.channels
					.fetch(process.env.DISCORD_PRONOTE_CHANNEL)
					.then((channel: TextChannel) => {
						channel.send({
							embeds: [embed],
						});
					});
			}
		}
	}

	const asyncFilter = async (arr, predicate) => {
		const results = await Promise.all(arr.map(predicate));

		return arr.filter((_v, index) => results[index]);
	};

	async function syncHomeworks() {
		const homeworks = await session.homeworks(
			new Date(Date.now()),
			session.params.lastDay
		);
		const newHomeworks = await asyncFilter(homeworks, async homework => {
			return (
				(await prisma.homework.findFirst({
					where: {
						id: homework.id,
					},
				})) == undefined
			);
		});

		for (const homework of newHomeworks) {
			await prisma.homework.create({
				data: {
					id: homework.id,
					subject: homework.subject,
					description: homework.description,
					for: homework.for,
					givenAt: homework.givenAt,
				},
			});

			const embed = new EmbedBuilder()
				.setTitle(homework.subject.toUpperCase())
				.setDescription(homework.description)
				.setFooter({
					text: `Devoir pour le ${moment(homework.for)
						.locale("fr")
						.format("dddd Do MMMM")}`,
				})
				.setTimestamp(homework.givenAt)
				.setColor(homework.color as ColorResolvable)
				.setURL(process.env.PRONOTE_URL);

			if (homework.files.length > 0) {
				embed.addFields([
					{
						name: "Pièces jointes",
						value: homework.files
							.map(file => `[${file.name}](${file.url})`)
							.join("\n"),
					},
				]);
			}

			client.channels
				.fetch(process.env.DISCORD_PRONOTE_CHANNEL)
				.then((channel: TextChannel) => {
					channel.send({
						embeds: [embed],
					});
				});
		}
	}

	async function syncInfos() {
		const infos = await session.infos();
		const newInfos = await asyncFilter(infos, async info => {
			return (
				(await prisma.info.findFirst({
					where: {
						id: info.id,
					},
				})) == undefined
			);
		});

		for (const info of newInfos) {
			await prisma.info.create({
				data: {
					id: info.id,
					date: info.date,
					author: info.author,
					title: info.title,
					content: info.content,
				},
			});
			const embed = new EmbedBuilder()
				.setTitle(info.title)
				.setDescription(info.content)
				.setFooter({
					text: `Par ${info.author}`,
				})
				.setTimestamp(info.date)
				.setColor("#70C7A4")
				.setURL(process.env.PRONOTE_URL);

			if (info.files.length > 0) {
				embed.addFields([
					{
						name: "Pièces jointes",
						value: info.files
							.map(file => `[${file.name}](${file.url})`)
							.join("\n"),
					},
				]);
			}

			client.channels
				.fetch(process.env.DISCORD_PRONOTE_CHANNEL)
				.then((channel: TextChannel) => {
					channel.send({
						embeds: [embed],
					});
				});
		}
	}

	client.login(process.env.DISCORD_TOKEN);
})();
