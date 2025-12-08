import type { ToolExecutionResult } from "../types";

/**
 * Execute Weather query using QWeather API
 */
export async function executeWeather(inputs: { city: string }): Promise<ToolExecutionResult> {
    try {
        const apiKey = process.env.QWEATHER_API_KEY;

        if (!apiKey) {
            return {
                success: false,
                error: "和风天气 API Key 未配置。请在环境变量中添加 QWEATHER_API_KEY。免费注册: https://dev.qweather.com/",
            };
        }

        // Step 1: Get city location ID using GeoAPI
        const geoResponse = await fetch(
            `https://geoapi.qweather.com/v2/city/lookup?location=${encodeURIComponent(inputs.city)}&key=${apiKey}`,
            { headers: { "Accept": "application/json" } }
        );

        if (!geoResponse.ok) {
            throw new Error(`城市查询失败: ${geoResponse.status}`);
        }

        const geoData = await geoResponse.json();

        if (geoData.code !== "200" || !geoData.location || geoData.location.length === 0) {
            return {
                success: false,
                error: `未找到城市: ${inputs.city}。请检查城市名称是否正确。`,
            };
        }

        const locationId = geoData.location[0].id;
        const cityName = geoData.location[0].name;
        const adm = geoData.location[0].adm1; // Province/State

        // Step 2: Get current weather
        const weatherResponse = await fetch(
            `https://devapi.qweather.com/v7/weather/now?location=${locationId}&key=${apiKey}`,
            { headers: { "Accept": "application/json" } }
        );

        if (!weatherResponse.ok) {
            throw new Error(`天气查询失败: ${weatherResponse.status}`);
        }

        const weatherData = await weatherResponse.json();

        if (weatherData.code !== "200") {
            throw new Error(`天气 API 错误: ${weatherData.code}`);
        }

        const now = weatherData.now;

        return {
            success: true,
            data: {
                city: cityName,
                province: adm,
                updateTime: now.obsTime,
                weather: {
                    text: now.text,
                    temp: `${now.temp}°C`,
                    feelsLike: `${now.feelsLike}°C`,
                    humidity: `${now.humidity}%`,
                    windDir: now.windDir,
                    windScale: `${now.windScale}级`,
                    windSpeed: `${now.windSpeed} km/h`,
                    precip: `${now.precip} mm`,
                    pressure: `${now.pressure} hPa`,
                    visibility: `${now.vis} km`,
                },
                summary: `${cityName}当前天气: ${now.text}，温度 ${now.temp}°C，体感温度 ${now.feelsLike}°C，${now.windDir} ${now.windScale}级，湿度 ${now.humidity}%`,
            },
        };
    } catch (error) {
        console.error("Weather error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "天气查询失败",
        };
    }
}
