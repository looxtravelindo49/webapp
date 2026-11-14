<script lang="ts">
	import { HERO_DESKTOP_MEDIA, HERO_MOBILE_MEDIA, hero } from '#lib/content/hero.js';
	import { FLOAT_WA_NUMBER, floatWaMessage, waLink } from '#lib/whatsapp.js';

	const chatHref = waLink(FLOAT_WA_NUMBER, floatWaMessage());
</script>

<svelte:head>
	<link
		rel="preload"
		as="image"
		href={hero.desktopImage}
		type="image/webp"
		media={HERO_DESKTOP_MEDIA}
		fetchpriority="high"
	/>
	<link
		rel="preload"
		as="image"
		href={hero.mobileImage}
		type="image/webp"
		media={HERO_MOBILE_MEDIA}
		fetchpriority="high"
	/>
</svelte:head>

<section class="loox-hero on-dark">
	<picture>
		<source media={HERO_MOBILE_MEDIA} srcset={hero.mobileImage} type="image/webp" />
		<img
			src={hero.desktopImage}
			alt={hero.imageAlt}
			width={hero.imageWidth}
			height={hero.imageHeight}
			fetchpriority="high"
			decoding="async"
		/>
	</picture>
	<div class="c">
		<div class="inner">
			<ul class="chips">
				{#each hero.chips as chip (chip)}
					<li>{chip}</li>
				{/each}
			</ul>
			<h1>
				{hero.titleLines[0]}<br />
				{hero.titleLines[1]}<br />
				<span>{hero.titleEmphasis}</span>
			</h1>
			<p>{hero.description}</p>
			<div class="btns">
				<a class="pk" href={hero.primaryCta.href}>{hero.primaryCta.label}</a>
				<a class="wa" href={chatHref} target="_blank" rel="noopener noreferrer">{hero.chatCta.label}</a>
			</div>
			<ul class="promise">
				{#each hero.promise as item (item)}
					<li><span aria-hidden="true">✓</span>{item}</li>
				{/each}
			</ul>
		</div>
	</div>
</section>

<style>
	.loox-hero {
		--hdr: 80px;
		--blue: #0d01ff;
		--lime: #e5ff00;
		position: relative;
		z-index: 0;
		isolation: isolate;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		overflow: hidden;
		background: #0b1a12;
		color: #fff;
		text-align: left;
	}
	.loox-hero picture,
	.loox-hero picture img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.loox-hero picture img {
		object-fit: cover;
		object-position: center 50%;
		display: block;
		max-width: none;
	}
	.loox-hero:before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		background:
			linear-gradient(90deg, rgba(4, 8, 30, 0.78) 0%, rgba(4, 8, 30, 0.55) 32%, rgba(4, 8, 30, 0) 58%),
			linear-gradient(to top, rgba(5, 12, 8, 0.55) 0%, rgba(5, 12, 8, 0) 30%),
			linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0) 18%);
	}
	.c {
		position: relative;
		z-index: 2;
		max-width: 1360px;
		width: 100%;
		margin: 0 auto;
		padding: calc(var(--hdr) + 40px) 40px 9vh;
	}
	.inner {
		max-width: 600px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 0 22px;
		padding: 0;
		list-style: none;
	}
	.chips li {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #fff;
		padding: 7px 13px;
		border-radius: 30px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.28);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
	}
	.chips li:first-child {
		background: var(--lime);
		color: var(--blue);
		border-color: var(--lime);
	}
	h1 {
		font-size: clamp(44px, 5.2vw, 76px);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.03em;
		margin: 0 0 22px;
		color: #fff;
		text-shadow: 0 2px 18px rgba(0, 0, 0, 0.45);
	}
	h1 > span {
		position: relative;
		z-index: 0;
		color: var(--lime);
	}
	h1 > span:after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0.02em;
		height: 0.12em;
		background: var(--blue);
		z-index: -1;
		border-radius: 4px;
	}
	p {
		margin: 0 0 30px;
		max-width: 520px;
		font-size: clamp(16px, 1.35vw, 19px);
		line-height: 1.55;
		color: rgba(255, 255, 255, 0.92);
		padding-left: 16px;
		border-left: 3px solid var(--lime);
		text-shadow: 0 1px 10px rgba(0, 0, 0, 0.5);
	}
	.btns {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.btns a {
		display: inline-block;
		margin: 0;
		padding: 15px 30px;
		border-radius: 40px;
		font-size: 16px;
		font-weight: 700;
		text-align: center;
		text-decoration: none;
		transition: transform 0.15s;
	}
	.pk {
		background: var(--lime);
		border: 2px solid var(--lime);
		color: var(--blue);
		box-shadow: 0 10px 30px rgba(229, 255, 0, 0.25);
	}
	.wa {
		background: rgba(255, 255, 255, 0.08);
		border: 2px solid #fff;
		color: #fff;
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
	}
	.promise {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		margin: 34px 0 0;
		padding: 20px 0 0;
		gap: 10px 26px;
		border-top: 1px solid rgba(255, 255, 255, 0.22);
		max-width: 560px;
		font-size: 13.5px;
		font-weight: 600;
		text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
	}
	.promise li {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.promise span {
		display: inline-grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--lime);
		color: var(--blue);
		font-size: 11px;
		font-weight: 800;
	}

	@media (max-width: 767px), (max-width: 1024px) and (orientation: portrait) {
		.loox-hero {
			--hdr: 72px;
			align-items: flex-start;
		}
		.loox-hero:before {
			background:
				linear-gradient(rgba(4, 8, 30, 0.72) 0%, rgba(4, 8, 30, 0.5) 34%, rgba(4, 8, 30, 0.1) 52%, rgba(0, 0, 0, 0) 62%),
				linear-gradient(to top, rgba(4, 8, 30, 0.85) 0%, rgba(4, 8, 30, 0) 26%);
		}
		.loox-hero picture,
		.loox-hero picture img {
			top: auto;
			bottom: 0;
			height: 112%;
		}
		.loox-hero picture {
			top: -12%;
			height: auto;
		}
		.loox-hero picture img {
			position: absolute;
			inset: auto 0 0 0;
			height: 100%;
			object-position: center 100%;
			transform: translateY(10%);
		}
		.c {
			/* 28px mockup, plus room so the promise sits above the tombol WhatsApp mengambang. */
			padding: calc(var(--hdr) + 44px) 20px max(84px, calc(env(safe-area-inset-bottom) + 72px));
			min-height: 100vh;
			display: flex;
			flex-direction: column;
		}
		.inner {
			flex: 1;
			display: flex;
			flex-direction: column;
		}
		.chips li:nth-child(n + 4) {
			display: none;
		}
		.chips {
			gap: 6px;
			margin-bottom: 16px;
		}
		.chips li {
			font-size: 9px;
			padding: 5px 9px;
			letter-spacing: 0.1em;
		}
		h1 {
			font-size: 40px;
			margin-bottom: 14px;
		}
		p {
			font-size: 14.5px;
			margin-bottom: 0;
			padding-left: 12px;
		}
		.btns {
			margin-top: auto;
			flex-wrap: nowrap;
			gap: 10px;
		}
		.btns a {
			flex: 1;
			padding: 14px 10px;
			font-size: 15px;
		}
		.promise {
			margin: 14px 0 0;
			padding-top: 12px;
			gap: 6px 14px;
			font-size: 11.5px;
			justify-content: center;
		}
		.promise span {
			width: 16px;
			height: 16px;
			font-size: 9px;
		}
	}

	@media (min-width: 768px) and (max-width: 1024px) and (orientation: portrait) {
		h1 {
			font-size: 56px;
		}
	}
</style>
